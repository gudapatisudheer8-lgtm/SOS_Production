#!/usr/bin/env python3
"""Switch only the SOS web root to a checksummed, versioned frontend."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
from datetime import datetime, timezone

SOURCE = Path(__file__).resolve().parent
DOMAIN = "sos.krishisetu9.in"
BASE_RELEASE = "sos-fresh-ec2-20261010"
SNIPPET = Path("/etc/nginx/snippets/syndicateos-fresh.conf")


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def https(path):
    return run(["curl", "--fail", "--silent", "--show-error", "--max-time", "10",
                "--noproxy", "*", "--resolve", f"{DOMAIN}:443:127.0.0.1",
                f"https://{DOMAIN}{path}"])


def main():
    if os.geteuid() != 0:
        raise SystemExit("Use sudo. No changes made.")
    for line in (SOURCE / "FILES.sha256").read_text().splitlines():
        expected, relative = line.split("  ", 1)
        file = SOURCE / relative
        if not file.resolve().is_relative_to(SOURCE) or file.is_symlink():
            raise SystemExit("Unsafe package path. No changes made.")
        if hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise SystemExit(f"Checksum mismatch: {relative}. No changes made.")
    marker = json.loads((SOURCE / "web/release.json").read_text())
    fix = marker.get("frontend_fix", "")
    if marker.get("release") != BASE_RELEASE or not re.fullmatch(r"[a-z0-9-]{1,80}", fix):
        raise SystemExit("Invalid frontend metadata. No changes made.")
    base = json.loads(Path("/opt/syndicateos/current/web/release.json").read_text())
    if base.get("release") != BASE_RELEASE:
        raise SystemExit("Unexpected base installation. No changes made.")
    run(["systemctl", "is-active", "--quiet", "syndicateos-api"])
    if json.loads(https("/api/readyz")).get("status") != "ready":
        raise SystemExit("Current API is not ready. No changes made.")
    original = SNIPPET.read_text()
    roots = re.findall(r"(?m)^root (/opt/syndicateos/(?:current/web|frontend-fixes/[a-z0-9-]+/web));$", original)
    if len(roots) != 1:
        raise SystemExit("Unexpected SOS Nginx root. Stop for review; no changes made.")
    destination = Path("/opt/syndicateos/frontend-fixes") / fix / "web"
    if destination.exists():
        for file in (SOURCE / "web").rglob("*"):
            if file.is_file():
                installed = destination / file.relative_to(SOURCE / "web")
                if not installed.is_file() or hashlib.sha256(installed.read_bytes()).digest() != hashlib.sha256(file.read_bytes()).digest():
                    raise SystemExit("Existing versioned frontend differs. No changes made.")
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(SOURCE / "web", destination)
    for item in [destination, *destination.rglob("*")]:
        item.chmod(0o755 if item.is_dir() else 0o644)
    backups = Path("/opt/syndicateos/frontend-routing-backups")
    backups.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = backups / f"{fix}-{stamp}.conf"
    backup.write_text(original)
    updated = original.replace(f"root {roots[0]};", f"root {destination};")
    try:
        SNIPPET.write_text(updated)
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        last_error = None
        for _ in range(12):
            try:
                active = json.loads(https("/release.json"))
                if active.get("release") != BASE_RELEASE or active.get("frontend_fix") != fix:
                    raise RuntimeError("HTTPS is not serving the expected frontend.")
                if json.loads(https("/api/readyz")).get("status") != "ready":
                    raise RuntimeError("API readiness failed after the web-root switch.")
                print(f"Frontend {fix} activated; HTTPS and API readiness passed.")
                print(f"Prior routing saved at {backup}. Database, uploads and base release were preserved.")
                return
            except (subprocess.CalledProcessError, ValueError, RuntimeError) as error:
                last_error = error
                time.sleep(1)
        raise RuntimeError(f"Activation verification failed: {last_error}")
    except Exception:
        SNIPPET.write_text(original)
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        raise


if __name__ == "__main__":
    main()
