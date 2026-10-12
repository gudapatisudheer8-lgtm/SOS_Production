#!/usr/bin/env python3
"""Package verified outputs; never connect to EC2/RDS or overwrite a release."""
import hashlib
import json
from pathlib import Path
import shutil
import tarfile

ROOT = Path(__file__).resolve().parents[2]
FIX = "sos-project-controls-20261012"
OUT = ROOT / "generated-artifacts/ec2"
STAGE = OUT / FIX
ARCHIVE = OUT / f"{FIX}.tar.gz"


def main():
    if STAGE.exists() or ARCHIVE.exists():
        raise SystemExit("This update already exists. Never overwrite a shared update.")
    web = ROOT / "artifacts/syndicateos-web/dist/public"
    jar = ROOT / "artifacts/api-server/target/sos-api.jar"
    index = (web / "index.html").read_text()
    if "/assets/" not in index or "/syndicateos-web/" in index or not jar.is_file():
        raise SystemExit("Build current production outputs at BASE_PATH=/ before packaging.")
    shutil.copytree(web, STAGE / "web")
    shutil.copyfile(jar, STAGE / "sos-api.jar")
    shutil.copyfile(ROOT / "scripts/ec2/apply-frontend-fix.py", STAGE / "apply-fix.py")
    api = (ROOT / "scripts/ec2/apply-drawing-api-fix.py").read_text()
    old = 'FIX = "sos-drawing-review-fix-20261010"'
    if api.count(old) != 1:
        raise SystemExit("API installer source changed; review before packaging.")
    api = api.replace(old, f'FIX = "{FIX}"').replace(
        "Drawing configuration capability patch installed; API readiness passed.",
        "Project-details update installed; API readiness passed.")
    (STAGE / "apply-api-fix.py").write_text(api)
    (STAGE / "web/release.json").write_text(json.dumps({
        "release": "sos-fresh-ec2-20261010", "schema_version": "19",
        "frontend_base": "/", "frontend_fix": FIX,
    }, indent=2) + "\n")
    (STAGE / "README.txt").write_text("""SyndicateOS accountant project controls

Install from this extracted directory:
  sha256sum -c FILES.sha256
  sudo python3 apply-api-fix.py
  sudo python3 apply-fix.py

API first, then frontend. Do not run stage, configure, initialize, migrations,
password resets or database deletion for this update.

Changes: visible authorized-firm selector; Edit Project follows the selected
project; Add Project starts fresh after closing; top Plans & Documents card
removed. Existing documents and new private uploads are in Edit Project.
Add Project retains every existing setup field and its document uploader.

Project details/settings save with optimistic revisions. Existing plots,
partners, accounts, balances and money records are not recreated by editing.
Those live records remain managed in their existing tabs. Firm selection only
lists firms returned for the signed-in session; this update does not grant
cross-firm access or change the firm-scoped sign-in model.

Open the site in a new private window after activation. Select a project,
edit its name/notes, save, reload and reopen to confirm the change. Confirm
its accounts and inventory remain unchanged. Cancel a typed Add Project
draft, reopen Add Project and confirm the input is blank. Check saved
documents inside Edit Project. The installers verify readiness/release
markers but cannot substitute for this signed-in acceptance check.

The original checksummed release, private uploads, credentials and database
are preserved. API and Nginx changes have reversible backups and roll back
automatically if activation verification fails.

Video work and the larger approval/push-notification redesign remain draft;
this update does not implement those unrelated changes.
""")
    lines = [f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.relative_to(STAGE)}"
             for file in sorted(STAGE.rglob("*")) if file.is_file()]
    (STAGE / "FILES.sha256").write_text("\n".join(lines) + "\n")
    with tarfile.open(ARCHIVE, "w:gz") as tar:
        tar.add(STAGE, arcname=FIX)
    print(f"Archive: {ARCHIVE.relative_to(ROOT)}")
    print(f"SHA256: {hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
