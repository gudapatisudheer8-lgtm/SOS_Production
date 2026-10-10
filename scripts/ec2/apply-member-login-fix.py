#!/usr/bin/env python3
"""Install the member-login frontend fix without changing the API or database."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone

SOURCE = Path(__file__).resolve().parent
FIX = "sos-member-login-fix-20261010"
DOMAIN = "sos.krishisetu9.in"
BASE_RELEASE = "sos-fresh-ec2-20261010"
DESTINATION = Path("/opt/syndicateos/frontend-fixes") / FIX / "web"
SNIPPET = Path("/etc/nginx/snippets/syndicateos-fresh.conf")


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def https(path):
    return run(["curl", "--fail", "--silent", "--show-error", "--max-time", "10",
                "--noproxy", "*", "--resolve", f"{DOMAIN}:443:127.0.0.1",
                f"https://{DOMAIN}{path}"])


def main():
    if os.geteuid() != 0:
        sys.exit("Use sudo. No changes made.")
    for line in (SOURCE / "FILES.sha256").read_text().splitlines():
        expected, relative = line.split("  ", 1)
        file = SOURCE / relative
        if not file.resolve().is_relative_to(SOURCE) or file.is_symlink():
            sys.exit("Unsafe package path. No changes made.")
        if hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            sys.exit(f"Checksum mismatch: {relative}. No changes made.")
    release = json.loads(Path("/opt/syndicateos/current/web/release.json").read_text())
    if release.get("release") != BASE_RELEASE:
        sys.exit("This fix requires the confirmed fresh release. No changes made.")
    run(["systemctl", "is-active", "--quiet", "syndicateos-api"])
    if json.loads(https("/api/readyz")).get("status") != "ready":
        sys.exit("Current API is not ready. No changes made.")
    original = SNIPPET.read_text()
    old_root = "root /opt/syndicateos/current/web;"
    new_root = f"root {DESTINATION};"
    if original.count(old_root) != 1 and original.count(new_root) != 1:
        sys.exit("Unexpected Nginx root. Stop for review; no changes made.")
    source_web = SOURCE / "web"
    if DESTINATION.exists():
        for file in source_web.rglob("*"):
            if file.is_file():
                target = DESTINATION / file.relative_to(source_web)
                if not target.is_file() or file.read_bytes() != target.read_bytes():
                    sys.exit("Existing fix folder differs. No configuration changed.")
    else:
        DESTINATION.parent.mkdir(parents=True, mode=0o755)
        shutil.copytree(source_web, DESTINATION)
    # Only newly copied public frontend files; never touch env files or uploads.
    for directory in (DESTINATION.parent.parent, DESTINATION.parent, DESTINATION):
        directory.chmod(0o755)
    for file in DESTINATION.rglob("*"):
        file.chmod(0o755 if file.is_dir() else 0o644)
    backup_dir = Path("/opt/syndicateos/frontend-fix-backups")
    backup_dir.mkdir(mode=0o700, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = backup_dir / f"{FIX}-{stamp}.conf"
    shutil.copy2(SNIPPET, backup)
    print(f"Nginx snippet backup: {backup}", flush=True)
    SNIPPET.write_text(original.replace(old_root, new_root, 1))
    try:
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        # A reload returns before every worker has adopted the new routing.
        failure = None
        for _ in range(20):
            try:
                marker = json.loads(https("/release.json"))
                if marker.get("release") != BASE_RELEASE or marker.get("frontend_fix") != FIX:
                    raise ValueError("Waiting for the new frontend routing.")
                if json.loads(https("/api/readyz")).get("status") != "ready":
                    raise ValueError("API readiness check failed.")
                index = (DESTINATION / "index.html").read_text()
                import re
                script = re.search(r'src="(/assets/[^"]+\.js)"', index).group(1)
                for path in ("/", "/owner"):
                    if script not in https(path):
                        raise ValueError(f"{path} is not serving the fixed frontend.")
                failure = None
                break
            except (subprocess.CalledProcessError, ValueError, json.JSONDecodeError) as error:
                failure = error
                time.sleep(1)
        if failure is not None:
            raise failure
    except Exception:
        SNIPPET.write_text(original)
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        print("Verification failed; previous frontend routing restored.", file=sys.stderr)
        raise
    print("Member-login frontend fix installed; HTTPS routes and API readiness passed.")
    print("No database changes, password resets, or API restarts were performed.")
    print(f"Open https://{DOMAIN}/ in a private browser window.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, subprocess.CalledProcessError, ValueError, json.JSONDecodeError) as error:
        sys.exit(f"Fix stopped: {error}. Do not rerun database initialization.")
