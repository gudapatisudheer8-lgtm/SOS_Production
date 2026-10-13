#!/usr/bin/env python3
"""Export the latest mobile browser frontend for the existing EC2 API."""
import hashlib
import html
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
NAME = "sos-mobile-20261013"
OUT = ROOT / "generated-artifacts/ec2"
STAGE = OUT / NAME
APP = ROOT / "artifacts/syndicateos-mobile"

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    if STAGE.exists():
        raise RuntimeError("Release already staged; use a new release name rather than overwriting.")
    with urllib.request.urlopen("https://sos.krishisetu9.in/release.json", timeout=15) as response:
        existing = json.load(response)
    if existing.get("schema_version") != "22" or existing.get("frontend_fix") != "sos-consolidated-20261013-registration-label":
        raise RuntimeError("Unexpected EC2 baseline; stop and review compatibility.")
    STAGE.mkdir(parents=True)
    env = {**os.environ, "CI": "1", "EXPO_PUBLIC_DOMAIN": "sos.krishisetu9.in",
           "SOS_MOBILE_WEB_BASE_PATH": "/mobile"}
    subprocess.run(["pnpm", "exec", "expo", "export", "--platform", "web", "--output-dir", str(STAGE / "mobile")],
                   cwd=APP, env=env, check=True)
    page = (STAGE / "mobile/index.html").read_text()
    if "/mobile/_expo/" not in page:
        raise RuntimeError("Export did not preserve /mobile paths.")
    assets = []
    for suffix in [".js", ".ttf", ".png"]:
        matches = sorted(path for path in (STAGE / "mobile").rglob("*") if path.is_file() and path.suffix == suffix)
        if not matches:
            raise RuntimeError("Missing verification asset " + suffix)
        assets.append(str(matches[0].relative_to(STAGE / "mobile")))
    meta = {"release": NAME, "mobile_base": "/mobile", "api_origin": "https://sos.krishisetu9.in",
            "existingWebRelease": existing, "verifyAssets": assets}
    (STAGE / "mobile/release.json").write_text(json.dumps(meta, indent=2) + "\n")
    shutil.copyfile(ROOT / "scripts/ec2/mobile-update.py", STAGE / "install.py")
    shutil.copyfile(ROOT / "scripts/ec2/syndicateos-mobile.nginx.conf", STAGE / "mobile.nginx.conf")
    manifest = {str(path.relative_to(STAGE)): digest(path) for path in sorted(STAGE.rglob("*")) if path.is_file()}
    (STAGE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    archive = OUT / (NAME + ".tar.gz")
    with tarfile.open(archive, "w:gz") as file:
        file.add(STAGE, arcname=NAME)
    checksum = digest(archive)
    (OUT / (archive.name + ".sha256")).write_text(checksum + "  " + archive.name + "\n")
    guide = (ROOT / "docs/sos-mobile-ec2-update.md").read_text().replace("{{SHA256}}", checksum)
    (OUT / (NAME + "-Instructions.md")).write_text(guide)
    blocks = []
    fence = False
    for line in guide.splitlines():
        if line.startswith("```"):
            blocks.append("</code></pre>" if fence else "<pre><code>")
            fence = not fence
        elif fence:
            blocks.append(html.escape(line) + "\n")
        elif line.startswith("#"):
            level = min(len(line) - len(line.lstrip("#")), 3)
            blocks.append(f"<h{level}>" + html.escape(line.lstrip("# ")) + f"</h{level}>")
        else:
            blocks.append("<p>" + html.escape(line) + "</p>" if line else "<br>")
    document = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>SOS mobile EC2 instructions</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:30px auto;padding:20px;background:#fffdf7;color:#172033}pre{background:#111827;color:#fff;padding:18px;overflow:auto;border-radius:10px}h2{color:#9a5700}</style>" + "".join(blocks)
    (OUT / (NAME + "-Deployment-Guide.html")).write_text(document)
    print(json.dumps({"archive": str(archive.relative_to(ROOT)), "sha256": checksum,
                      "guide": str((OUT / (NAME + "-Deployment-Guide.html")).relative_to(ROOT))}, indent=2))

if __name__ == "__main__":
    main()
