#!/usr/bin/env python3
"""Side-by-side API patch: preserve the original checksummed release."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
FIX = "sos-drawing-review-fix-20261010"


def run(*command):
    subprocess.run(command, check=True)


def ready():
    with urllib.request.urlopen("https://sos.krishisetu9.in/api/readyz", timeout=10) as response:
        return response.status == 200


def main():
    if os.geteuid() != 0:
        raise SystemExit("Run with sudo.")
    marker = json.loads(Path("/opt/syndicateos/current/deployment.json").read_text())
    if marker["release"] != "sos-fresh-ec2-20261010" or marker["schema_version"] != "19":
        raise SystemExit("Unexpected base release; no service changes made.")
    run("sha256sum", "-c", str(ROOT / "FILES.sha256"))
    run("systemctl", "is-active", "--quiet", "syndicateos-api")
    ready()
    # Preserve the original deployment's JVM limits, loopback binding, private
    # uploads, and disabled runtime migrations. Only the jar path changes.
    original = Path("/opt/syndicateos/current/syndicateos-api.service").read_text()
    commands = [line for line in original.splitlines() if line.startswith("ExecStart=")]
    if len(commands) != 1 or "-jar /opt/syndicateos/current/sos-api.jar" not in commands[0]:
        raise SystemExit("Unexpected original service command; no changes made.")
    destination = Path("/opt/syndicateos/api-fixes") / FIX
    jar = destination / "sos-api.jar"
    if destination.exists():
        if not jar.is_file() or hashlib.sha256(jar.read_bytes()).digest() != hashlib.sha256((ROOT / "sos-api.jar").read_bytes()).digest():
            raise SystemExit("Existing API patch directory does not match this package.")
    else:
        destination.mkdir(parents=True, mode=0o755)
        shutil.copyfile(ROOT / "sos-api.jar", jar)
        jar.chmod(0o644)
    overrides = Path("/etc/systemd/system/syndicateos-api.service.d")
    overrides.mkdir(mode=0o755, parents=True, exist_ok=True)
    override = overrides / "drawing-review.conf"
    before = override.read_bytes() if override.exists() else None
    command = commands[0].replace("/opt/syndicateos/current/sos-api.jar", str(jar))
    try:
        override.write_text("[Service]\nExecStart=\n" + command + "\n")
        override.chmod(0o644)
        run("systemctl", "daemon-reload")
        run("systemctl", "restart", "syndicateos-api")
        active = subprocess.check_output(["systemctl", "show", "-p", "ExecStart", "--value", "syndicateos-api"], text=True)
        if str(jar) not in active:
            raise RuntimeError("Another service override prevented activation of the patched API.")
        for _ in range(45):
            try:
                if ready():
                    print("Drawing configuration capability patch installed; API readiness passed.")
                    print("No migration, credential reset or original-release overwrite was performed.")
                    return
            except (OSError, ValueError):
                pass
            time.sleep(2)
        raise RuntimeError("Patched API did not become ready within 90 seconds.")
    except Exception:
        if before is None:
            override.unlink(missing_ok=True)
        else:
            override.write_bytes(before)
        run("systemctl", "daemon-reload")
        run("systemctl", "restart", "syndicateos-api")
        raise


if __name__ == "__main__":
    main()
