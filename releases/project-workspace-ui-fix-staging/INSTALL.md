# SOS project setup activation and dashboard update

Requires the already installed `sos-project-workspace-v7-documents` API/schema.
This is a web-only update: no new JAR, Flyway migration, grants, credential reset,
sample data, configuration fallback or database rebuild.

## What was confirmed

CSA was assigned **Original dashboard · Open plotting**, version 2. It has
no project setup definition. The published **Project workspace · Open plotting**
release already has the definition. The activation SQL switches only that
existing assignment, recording the previous release in the owner audit.

Shivani Infra had zero operational records, financial postings, attachments,
ERP audit entries and partner links when checked. The removal SQL checks these
again with a project lock; any new linked data blocks deletion.

## Backup and upload

Take a fresh SOS database backup/snapshot first. Download the archive and its
`.sha256` file into Windows Downloads:

```powershell
scp -i "$env:USERPROFILE\Downloads\SOS.pem" "$env:USERPROFILE\Downloads\sos-project-setup-ui-fix.tar.gz" "$env:USERPROFILE\Downloads\sos-project-setup-ui-fix.tar.gz.sha256" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$env:USERPROFILE\Downloads\SOS.pem" ubuntu@3.111.185.116
```

## Prepare EC2

```bash
set -e
cd /home/ubuntu
sha256sum -c sos-project-setup-ui-fix.tar.gz.sha256
FIX_DIR="$(mktemp -d /home/ubuntu/sos-setup-fix-XXXXXX)"
tar -xzf sos-project-setup-ui-fix.tar.gz -C "$FIX_DIR"
cd "$FIX_DIR"
sha256sum -c FILES.sha256
sudo nginx -t
sudo systemctl stop syndicateos-api
echo "Update folder: $FIX_DIR"
```

Keep this EC2 session open. Existing Nginx, JAR, service environment and private
uploads remain untouched.

## Run the two SQL files in pgAdmin

Download `01-activate-project-setup.sql` and `02-remove-empty-shivani.sql`.
Open Query Tool for the **SOS** database as the administrator. Open/run each file
separately, in that order. Do not run them against `krishisetu` or another database.
Each file contains an explicit transaction and a verification SELECT.

Expected:
- Activation: **Project workspace · Open plotting**, `has_project_setup = true`.
- Removal: `remaining_shivani_projects = 0`.

If either fails, run `ROLLBACK;` in that Query Tool and stop. Do not disable
triggers or delete dependent records to force removal. The removal is permanent
for the empty project only, and both scripts are safe to repeat after success.
No users/PINs, firm identity, other projects or financial history are deleted.

You can read the bundled SQL on EC2 with:
```bash
cat 01-activate-project-setup.sql
cat 02-remove-empty-shivani.sql
```

## Install the web files (same EC2 session)

```bash
set -e
sudo test -f /opt/syndicateos/web/index.html
NEXT_WEB="$(sudo mktemp -d /opt/syndicateos/web.next-XXXXXX)"
sudo cp -a web/. "$NEXT_WEB/"
sudo chown -R root:root "$NEXT_WEB"
sudo find "$NEXT_WEB" -type d -exec chmod 755 {} \;
sudo find "$NEXT_WEB" -type f -exec chmod 644 {} \;
sudo test -f "$NEXT_WEB/index.html"
PREVIOUS_WEB="/opt/syndicateos/web.before-setup-fix-$(date +%Y%m%d-%H%M%S)"
sudo mv /opt/syndicateos/web "$PREVIOUS_WEB"
sudo mv "$NEXT_WEB" /opt/syndicateos/web
echo "Previous web saved at: $PREVIOUS_WEB"
sudo systemctl start syndicateos-api
sudo systemctl is-active syndicateos-api
sudo nginx -t
sudo journalctl -u syndicateos-api --since "2 minutes ago" --no-pager
```

The API may take several seconds to finish starting. If the logs show a startup
failure, stop and share only the error, not environment files or credentials.
Do not change ports, database passwords, existing Nginx asset rules or TLS.

## Check in the browser

1. Sign out, hard-refresh with Ctrl+Shift+R, then sign back into the client portal.
2. Shivani Infra should no longer appear. The empty-project state should appear.
3. Add Project should open the database-configured setup sections.
4. Create a draft project; resume/edit it and confirm saved fields load.
5. The highlighted **Awaiting review by resource** card is removed from Dashboard.
   Approvals remain in their existing workflow/tab; no approval records were deleted.
6. Edit Setup becomes available when a project is selected.

No changes have been executed on EC2/RDS by Replit Agent. Source changes and SQL
were verified in an isolated local environment, not against the production app.
