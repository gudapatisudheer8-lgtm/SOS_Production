#!/usr/bin/env python3
"""Install only the public Expo web export alongside the existing SOS web/API."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.request
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
BASE = Path("/opt/syndicateos")
MAIN = Path("/etc/nginx/snippets/syndicateos-fresh.conf")
MOBILE = Path("/etc/nginx/snippets/syndicateos-mobile.conf")
LINK = BASE / "mobile-current"
ORIGIN = "https://sos.krishisetu9.in"
INCLUDE = "include /etc/nginx/snippets/syndicateos-mobile.conf;"

def run(*args):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout

def get(path):
    with urllib.request.urlopen(ORIGIN + path, timeout=15) as response:
        return response.read()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def symlink(target):
    temp = LINK.with_name("mobile-current.new")
    if temp.exists() or temp.is_symlink():
        temp.unlink()
    temp.symlink_to(target)
    os.replace(temp, LINK)

def verify(meta):
    manifest = json.loads((ROOT / "manifest.json").read_text())
    last = None
    for _ in range(8):
        try:
            actual = json.loads(get("/mobile/release.json"))
            if actual != meta:
                raise RuntimeError("The served mobile release does not match this package.")
            page = get("/mobile/")
            if b"/mobile/_expo/" not in page:
                raise RuntimeError("The mobile HTML is missing its /mobile bundle paths.")
            for asset in meta["verifyAssets"]:
                expected = manifest["mobile/" + asset]
                if digest(get("/mobile/" + quote(asset, safe="/@-._~"))) != expected:
                    raise RuntimeError("Incorrect public asset: " + asset)
            if json.loads(get("/api/readyz")).get("status") != "ready":
                raise RuntimeError("The existing API is not ready.")
            if json.loads(get("/release.json")) != meta["existingWebRelease"]:
                raise RuntimeError("The existing web release unexpectedly changed.")
            print("Verified: mobile HTML, JS/font/image bytes, existing web release and API readiness.")
            print(ORIGIN + "/mobile/")
            return
        except Exception as error:
            last = error
            time.sleep(2)
    raise RuntimeError(str(last))

def restore(backup):
    state = json.loads((backup / "state.json").read_text())
    MAIN.write_bytes((backup / "main.conf").read_bytes())
    if state["hadMobileSnippet"]:
        MOBILE.write_bytes((backup / "mobile.conf").read_bytes())
    elif MOBILE.exists():
        MOBILE.unlink()
    if state["previousTarget"]:
        symlink(state["previousTarget"])
    elif LINK.is_symlink():
        LINK.unlink()
    run("nginx", "-t")
    run("systemctl", "reload", "nginx")
    print("Previous mobile routing restored. Web/API/data were not replaced.")

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "verify"
    meta = json.loads((ROOT / "mobile/release.json").read_text())
    if mode == "verify":
        verify(meta)
        return
    if os.geteuid() != 0:
        raise RuntimeError("Use sudo for install or rollback.")
    if mode == "rollback":
        if len(sys.argv) != 3:
            raise RuntimeError("Usage: sudo python3 install.py rollback <printed backup directory>")
        backup = Path(sys.argv[2]).resolve()
        if backup.parent != Path("/var/backups/syndicateos-mobile"):
            raise RuntimeError("Use the backup directory printed by this installer.")
        restore(backup)
        return
    if mode != "install":
        raise RuntimeError("Choose install, verify, or rollback.")
    # Validate all package bytes and the existing deployment BEFORE changing routing.
    manifest = json.loads((ROOT / "manifest.json").read_text())
    for name, expected in manifest.items():
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file() or digest(path.read_bytes()) != expected:
            raise RuntimeError("Package verification failed: " + name)
    if not MAIN.is_file() or "syndicateos-fresh.conf" not in run("nginx", "-T"):
        raise RuntimeError("The existing SOS Nginx snippet is not active. Stop: do not guess a replacement site.")
    run("nginx", "-t")
    if json.loads(get("/api/readyz")).get("status") != "ready":
        raise RuntimeError("Existing API not ready; stop and diagnose before updating mobile.")
    if json.loads(get("/release.json")) != meta["existingWebRelease"]:
        raise RuntimeError("Existing web/API release differs from the verified baseline; obtain a matched package.")
    if LINK.exists() and not LINK.is_symlink():
        raise RuntimeError("mobile-current is a real directory; manual review required.")
    if INCLUDE not in MAIN.read_text() and "/mobile/" in run("nginx", "-T"):
        raise RuntimeError("Unmanaged /mobile routing exists; manual review required.")
    target = BASE / "mobile-releases" / meta["release"]
    if target.exists():
        raise RuntimeError("This release directory already exists. Run verify; do not overwrite it.")
    backup = Path("/var/backups/syndicateos-mobile") / (time.strftime("%Y%m%d-%H%M%S") + "-" + str(os.getpid()))
    backup.mkdir(parents=True, mode=0o700)
    backup.chmod(0o700)
    shutil.copyfile(MAIN, backup / "main.conf")
    state = {"previousTarget": str(LINK.resolve()) if LINK.is_symlink() else None,
             "hadMobileSnippet": MOBILE.exists()}
    if MOBILE.exists():
        shutil.copyfile(MOBILE, backup / "mobile.conf")
    (backup / "state.json").write_text(json.dumps(state))
    print("Routing backup:", backup, flush=True)
    target.mkdir(parents=True, mode=0o755)
    shutil.copytree(ROOT / "mobile", target / "mobile")
    for path in target.rglob("*"):
        path.chmod(0o755 if path.is_dir() else 0o644)
    try:
        MOBILE.write_bytes((ROOT / "mobile.nginx.conf").read_bytes())
        if INCLUDE not in MAIN.read_text():
            with MAIN.open("a") as file:
                file.write("\n# Separate mobile frontend; preserve original web and API.\n" + INCLUDE + "\n")
        symlink(target)
        run("nginx", "-t")
        run("systemctl", "reload", "nginx")
        verify(meta)
    except Exception:
        restore(backup)
        raise
    print("Installed mobile only. No API restart, schema migration, or customer-data changes.")
    print("Rollback: sudo python3", ROOT / "install.py", "rollback", backup)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("STOP:", error, file=sys.stderr)
        sys.exit(1)
