#!/usr/bin/env python3
"""Assemble current verified builds, never overwrite a shared archive or contact EC2."""
import hashlib
import html
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
FIX = "sos-consolidated-20261012"
OUT = ROOT / "generated-artifacts/ec2"
STAGE = OUT / FIX
ARCHIVE = OUT / f"{FIX}.tar.gz"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render_document(text):
    blocks = []
    fence = False
    for line in text.splitlines():
        if line.startswith("```"):
            blocks.append("</code></pre>" if fence else "<pre><code>")
            fence = not fence
        elif fence:
            blocks.append(html.escape(line) + "\n")
        elif line.startswith("#"):
            level = min(len(line) - len(line.lstrip("#")), 3)
            blocks.append(f"<h{level}>" + html.escape(line.lstrip("# ")) + f"</h{level}>")
        elif line:
            blocks.append("<div>" + html.escape(line).replace("**", "") + "</div>")
        else:
            blocks.append("<br>")
    return """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SyndicateOS consolidated EC2 deployment guide</title>
<style>body{font:15px/1.65 system-ui,sans-serif;color:#172033;background:#fbfaf6;margin:0}
main{max-width:1000px;margin:32px auto;padding:30px;background:white;border:1px solid #e5e0d4;border-radius:16px}
h1{font-size:28px}h2{margin-top:30px;color:#8a5700}h3{margin-top:24px}
pre{overflow-x:auto;padding:18px;background:#111827;color:#f5f5f5;border-radius:10px;font:13px/1.6 monospace;white-space:pre}
@media(max-width:600px){main{padding:18px;margin:12px}h1{font-size:23px}}</style><main>""" + "".join(blocks) + "</main></html>"


def main():
    if STAGE.exists() or ARCHIVE.exists():
        raise SystemExit("Release output already exists. Never overwrite a shared release.")
    web = ROOT / "artifacts/syndicateos-web/dist/public"
    jar = ROOT / "artifacts/api-server/target/sos-api.jar"
    migrations = ROOT / "artifacts/api-server/src/main/resources/db/migration"
    index = (web / "index.html").read_text()
    if "/assets/" not in index or "/syndicateos-web/" in index or "/@vite/" in index or "banner-script.js" in index:
        raise SystemExit("Build the current production frontend at BASE_PATH=/ first.")
    files = sorted(migrations.glob("V*.sql"))
    if sorted(int(path.name.split("__")[0][1:]) for path in files) != list(range(1, 22)):
        raise SystemExit("Expected exactly V1–V21.")
    baseline = OUT / "sos-fresh-ec2-20261010/migrations"
    for path in baseline.glob("V*.sql"):
        if digest(path) != digest(migrations / path.name):
            raise SystemExit("An existing migration was changed: " + path.name)
    with zipfile.ZipFile(jar) as archive:
        for path in files:
            if archive.read("BOOT-INF/classes/db/migration/" + path.name) != path.read_bytes():
                raise SystemExit("JAR has stale/missing migrations: " + path.name)
    shutil.copytree(web, STAGE / "web")
    shutil.copyfile(jar, STAGE / "sos-api.jar")
    shutil.copyfile(ROOT / "scripts/ec2/consolidated-update.py", STAGE / "update.py")
    shutil.copyfile(ROOT / "scripts/ec2/sql/03_update_runtime_permissions.sql", STAGE / "permissions.sql")
    shutil.copytree(migrations, STAGE / "migrations")
    documentation = (ROOT / "docs/sos-consolidated-ec2-update.md").read_text()
    (STAGE / "README.md").write_text(documentation)
    meta = {"update": FIX, "base_release": "sos-fresh-ec2-20261010", "schema_version": 21,
            "api_sha256": digest(jar), "index_sha256": digest(web / "index.html"),
            "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()}
    (STAGE / "update.json").write_text(json.dumps(meta, indent=2) + "\n")
    (STAGE / "web/release.json").write_text(json.dumps({
        "release": meta["base_release"], "schema_version": "21", "frontend_base": "/",
        "frontend_fix": FIX, "api_sha256": meta["api_sha256"],
    }, indent=2) + "\n")
    source_hashes = {}
    for directory in ("artifacts/syndicateos-web/src", "artifacts/api-server/src", "artifacts/syndicateos-mobile/app",
                      "artifacts/syndicateos-mobile/src", "artifacts/syndicateos-mobile/components",
                      "lib/api-spec", "lib/api-client-react/src", "scripts/ec2"):
        for path in (ROOT / directory).rglob("*"):
            if (path.is_file() and not path.name.startswith(".env")
                    and path.suffix not in {".pem", ".key", ".p12", ".jks"}
                    and not any(part in {"node_modules", ".expo", "dist", "target", "__pycache__", ".replit-artifact"} for part in path.parts)):
                source_hashes[str(path.relative_to(ROOT))] = digest(path)
    (STAGE / "SOURCE-FINGERPRINTS.json").write_text(json.dumps(source_hashes, indent=2, sort_keys=True) + "\n")
    package_files = sorted(path for path in STAGE.rglob("*") if path.is_file())
    (STAGE / "FILES.sha256").write_text("".join(f"{digest(path)}  {path.relative_to(STAGE)}\n" for path in package_files))
    with tarfile.open(ARCHIVE, "w:gz") as archive:
        archive.add(STAGE, arcname=FIX)
    checksum = digest(ARCHIVE)
    (OUT / f"{FIX}.tar.gz.sha256").write_text(f"{checksum}  {FIX}.tar.gz\n")
    handoff = f"""# Download, upload and install

Archive: {FIX}.tar.gz
SHA-256: {checksum}

## Windows PowerShell — archive and SSH key in Downloads

```powershell
Get-FileHash "$env:USERPROFILE\\Downloads\\{FIX}.tar.gz" -Algorithm SHA256
scp -i "$env:USERPROFILE\\Downloads\\SOS.pem" "$env:USERPROFILE\\Downloads\\{FIX}.tar.gz" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$env:USERPROFILE\\Downloads\\SOS.pem" ubuntu@3.111.185.116
```

Compare Get-FileHash with the SHA-256 above before uploading.

## EC2 SSH terminal — verify before extracting, then install

Paste this entire parenthesized block. It runs fail-fast in a subshell, not your
interactive SSH session. The checksum is inline; uploading a sidecar is not needed.

```bash
(
  set -eu
  cd /home/ubuntu
  printf '%s  %s\\n' '{checksum}' '{FIX}.tar.gz' | sha256sum -c -
  WORK=$(mktemp -d /home/ubuntu/{FIX}.XXXXXX)
  tar -xzf {FIX}.tar.gz -C "$WORK"
  cd "$WORK/{FIX}"
  sha256sum -c FILES.sha256
  sudo python3 update.py inspect
  sudo python3 update.py install
)
```

At the hidden prompt use the existing sos_deploy database password.
At confirmation type UPDATE SOS. The installer creates backups before migration.
Keep the private backup path it prints. Do NOT run any old fresh-install commands.

"""
    guide = OUT / f"{FIX}-Deployment-Guide.html"
    guide.write_text(render_document(handoff + documentation))
    print("Archive:", ARCHIVE.relative_to(ROOT))
    print("SHA256:", checksum)
    print("Guide:", guide.relative_to(ROOT))


if __name__ == "__main__":
    main()
