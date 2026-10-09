# Simple open plotting update — EC2

Contains the compiled web app, API JAR, guarded database upgrade utility and an explicit CSA release-activation SQL script. No sample projects, partners, accounts or transactions are included.

## What changes

- Facing cards: enter plot count and area per plot. Numbering is sequential across entered groups; optional individual details remain available.
- Partner equity drives calculated planned capital. Combined allocations cannot exceed 100% equity or the entered project cost. Drafts may be incomplete; final creation requires full equity if partners are entered.
- Bank entry displays only bank name, account holder name, account number, IFSC and branch. New accounts start at zero; old balances and effective dates remain unchanged.
- Business choices, labels, presentation metadata, defaults and allocation rules are in a new immutable PostgreSQL configuration release.
- Other sectors and older releases retain their existing forms.

This changes planned capital, not money received, posted balances, or expense approvals.

## 1. Upload and verify

Download both the archive and its checksum file, then upload both using your existing scp command.

On EC2:

```bash
set -e
cd /home/ubuntu
sha256sum -c sos-simple-open-plotting.tar.gz.sha256
UPDATE_DIR="$(mktemp -d /home/ubuntu/sos-simple-plots-XXXXXX)"
tar -xzf sos-simple-open-plotting.tar.gz -C "$UPDATE_DIR"
cd "$UPDATE_DIR"
sha256sum -c FILES.sha256
sudo nginx -t
printf 'Update folder: %s\n' "$UPDATE_DIR"
```

If the checksum file was not uploaded, upload it before continuing; do not skip verification.

## 2. Back up before changing production

Take a fresh SOS database backup and verify that it completed. The existing earlier backup may predate newly entered data.

```bash
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
sudo cp -a /opt/syndicateos/web "/opt/syndicateos/web.before-simple-plots-$STAMP"
sudo cp -a /opt/syndicateos/sos-api.jar "/opt/syndicateos/sos-api.jar.before-simple-plots-$STAMP"
sudo systemctl stop syndicateos-api
sudo ss -ltnp 'sport = :8090'
```

Port 8090 should now be empty. If a Java process is still listening, stop here and identify its owning service; do not kill an unknown process or change the port.

## 3. Apply the additive database migration

From the extracted update folder:

```bash
python3 upgrade.py
```

Enter the existing sos_migrator password at the hidden terminal prompt. This utility targets only the existing SOS database, applies migrations once through Flyway, and exits. It does not reset the owner or change firm assignments.

**Do not run V8 manually in pgAdmin.** That would bypass Flyway's migration history.

## 4. Activate the new forms explicitly

Print the activation SQL:

```bash
cat 01-activate-simple-open-plotting.sql
```

Copy the complete script into pgAdmin connected to **SOS** and execute it as the existing database administrator. It changes only CSA's open-plotting assignment and grants the runtime role access to the application tables.

Expected final row:

- Client code: CSA
- Release: Simple open plotting · Open plotting
- Presentation: open-plotting-simple

Do not proceed if the script fails or these values are different. Without this step, the application will keep displaying the older forms.

## 5. Install the compiled files

After upgrade and activation both succeed:

```bash
sudo install -o sos-api -g sos-api -m 0644 sos-api.jar /opt/syndicateos/sos-api.jar
sudo cp -a web/. /opt/syndicateos/web/
sudo nginx -t
sudo systemctl reset-failed syndicateos-api
sudo systemctl start syndicateos-api
sudo systemctl reload nginx
sleep 5
sudo systemctl status syndicateos-api --no-pager -l
sudo journalctl -u syndicateos-api -n 40 --no-pager
```

The web copy deliberately preserves old hashed assets so an already-open browser does not lose its loaded modules. The new index references the new compiled assets.

Then sign out, refresh the page with Ctrl+Shift+R, and sign in again. New setup should show the compact Plot Matrix, Partners & Equity and Bank Accounts sections.

Existing live project structure remains locked in setup; use its own tabs to manage partners, accounts and inventory. Existing drafts can be reviewed against the newly assigned release before saving; their existing child data is retained.

## If an upgrade fails

Do not restore an old database over newly created data. Keep the API stopped, retain the backup and copy the specific error output. If migration did not complete and the previous database schema is intact, restore the backed-up JAR/web pair before restarting. An already-applied additive configuration release should remain in the database; do not delete it or alter migration history.
