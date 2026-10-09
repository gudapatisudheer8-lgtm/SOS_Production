# SOS original-dashboard update — EC2

This update ports the accountant and partner modules from your SOS GitHub application.
It **does not reset the SOS database, owner, firm, users, PINs or existing projects**.
New configuration releases are added; existing firms remain on their assigned releases until you change them.
No AWS migration or deployment has been executed by Replit Agent.

## 1. Back up first

In AWS RDS, take a snapshot of the shared Krishisetu instance. Alternatively use pgAdmin's **Backup** for the **SOS** database.
Do not continue until the backup is successful. Never run these migrations against the other application's database.
Use a short maintenance window; the API is stopped while updating.

Download `sos-original-dashboards.tar.gz` and its checksum into your Windows Downloads folder.

**Windows PowerShell**
```powershell
Get-FileHash "$env:USERPROFILE\Downloads\sos-original-dashboards.tar.gz" -Algorithm SHA256
scp -i "$env:USERPROFILE\Downloads\SOS.pem" "$env:USERPROFILE\Downloads\sos-original-dashboards.tar.gz" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$env:USERPROFILE\Downloads\SOS.pem" ubuntu@3.111.185.116
```
Compare the hash against the downloaded `.sha256` file.

## 2. Unpack and preserve the installed files

**EC2 terminal**
```bash
cd /home/ubuntu
sha256sum sos-original-dashboards.tar.gz
mkdir -p sos-original-dashboards
tar -xzf sos-original-dashboards.tar.gz -C sos-original-dashboards
cd sos-original-dashboards
sha256sum -c FILES.sha256
sudo systemctl stop syndicateos-api
sudo ss -ltnp 'sport = :8090'
sudo ss -ltnp 'sport = :8091'
```
Both ports must be free. If a process is shown, stop the identified old setup process; **do not kill all Java processes**.

```bash
BACKUP="/opt/syndicateos/backups/dashboard-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP"
sudo cp -a /opt/syndicateos/sos-api.jar /opt/syndicateos/web "$BACKUP/"
sudo install -d -m 700 -o sos-api -g sos-api /var/lib/syndicateos/uploads
sudo cp -a /var/lib/syndicateos/uploads "$BACKUP/"
echo "Saved application and attachment backup to $BACKUP"
```
Keep this backup path. Attachment files and their database metadata must be backed up together.
If the service has `ProtectSystem=strict`, allow only its private upload directory:
```bash
sudo mkdir -p /etc/systemd/system/syndicateos-api.service.d
printf '[Service]\nReadWritePaths=/var/lib/syndicateos/uploads\n' | sudo tee /etc/systemd/system/syndicateos-api.service.d/uploads.conf >/dev/null
sudo systemctl daemon-reload
```

## 3. Upgrade only the existing SOS database

```bash
python3 upgrade.py
```
Enter the **sos_migrator** password at its hidden prompt—not the sos_app password or your owner PIN.
The script verifies the exact database name **SOS**, requires an existing migration history and owner,
uses TLS, runs additive migrations, validates configuration, then exits automatically.
It never enables normal business writes or creates demo data.
Expected Flyway version after this package: **5**.

If it reports an error, **stop here**. Do not manually insert Flyway history, run `clean`, delete tables or change old migrations.

**pgAdmin → Query Tool connected to SOS**
```sql
SELECT current_database();
SELECT version, description, success FROM sos.flyway_schema_history ORDER BY installed_rank;
SELECT count(*) AS owner_accounts FROM sos.owner_memberships;
SELECT s.code,r.version,r.label,r.state
FROM sos.sectors s JOIN sos.sector_releases r ON r.sector_id=s.id
ORDER BY s.code,r.version;
```
Existing owner count should be unchanged and migrations 1–5 successful.
The new releases are labelled **Original dashboard parity**.

## 4. Grant the existing runtime role access to the additive tables

Run in **pgAdmin → SOS** as the database administrator. Do not change ownership of unrelated schemas or databases.

```sql
GRANT USAGE ON SCHEMA sos TO sos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sos TO sos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sos TO sos_app;
```
The application's authorization, release-immutability and posting-immutability checks remain enforced.
Continue using **sos_app** for the service and **sos_migrator** only for guarded migrations.

## 5. Install JAR and web files

```bash
sudo install -m 644 sos-api.jar /opt/syndicateos/sos-api.jar
sudo cp -a /opt/syndicateos/web "/opt/syndicateos/web.before-dashboard-update-$(date +%s)"
sudo rm -rf /opt/syndicateos/web
sudo install -d -m 755 /opt/syndicateos/web
sudo cp -a web/. /opt/syndicateos/web/
sudo chown -R root:root /opt/syndicateos/web
sudo find /opt/syndicateos/web -type d -exec chmod 755 {} \;
sudo find /opt/syndicateos/web -type f -exec chmod 644 {} \;
sudo systemctl reset-failed syndicateos-api
sudo systemctl start syndicateos-api
sudo systemctl status syndicateos-api --no-pager
sudo journalctl -u syndicateos-api -n 60 --no-pager
sudo nginx -t
```
This replaces only the static web folder after backing it up; your DB and private uploads are not removed.
Keep your existing Nginx configuration, including its fix allowing Expo's exported public asset filenames.
The API remains on **127.0.0.1:8090**, not publicly exposed.
Leave setup approval, upgrade-only, setup-exit and preview-fixture **disabled in the normal service**.
The existing environment file should continue using sos_app, writable connections, enabled business writes and the AWS CA certificate.
Do not paste its contents into chat.

## 6. Assign the original dashboard release

1. Open **https://sos.krishisetu9.in/owner** and sign in.
2. Find your firm in **Firms**.
3. For its sector, select the latest published release labelled **Original dashboard parity**, then save the assignment.
4. Use the existing client link **https://sos.krishisetu9.in/**. Hard-refresh with Ctrl+Shift+R.
5. Enter the company code, then the accountant's 10-digit mobile and six-digit PIN.

You should now see the original-style dashboard tabs—not the old generic Workspace.
Existing projects remain. Existing financial records from Google AI Studio are **not imported automatically**;
this package migrates the interface and behavior, not prototype/demo financial data.
Partners continue using company code + their own mobile/PIN, with project-scoped access.
Owner remains a separate web-only portal.

## 7. Check before real use

Confirm accountant tabs, project/partner creation, accounts and inventory.
Using a small test record, check that money remains pending until approved and balances change once.
Check partner access, its own-review restriction, bookings and attachment upload/download.
Tally exports are draft vouchers; have your accountant confirm ledger mappings before importing.

## Rollback

If the web/JAR update fails, stop the service and restore the saved JAR and web folder, then restart.
The database migrations are additive, so **do not delete the new tables**.
Older code will ignore the new tables, but older clients cannot render the new dashboard configuration:
reassign the firm's previous published release before returning to the old client.
After new financial records exist, do not restore an old DB snapshot without a reviewed recovery plan—doing so loses those records.

## Private files / next deployment recommendation

On this single EC2 instance, attachments are private files in `/var/lib/syndicateos/uploads`,
with authorization-checked API downloads and metadata in PostgreSQL.
Keep an EBS/volume backup plus matching database backup.
**Recommendation:** move this private adapter to S3 before using multiple EC2 instances or replacing instances automatically.
Native capture/APK/IPA packaging and the public marketing quotation portal are separate follow-ups.
