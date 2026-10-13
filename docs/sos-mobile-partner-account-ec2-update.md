# SyndicateOS — Partner Project Account mobile update

Release: `sos-mobile-20261013-partner-account`

This is a **new** mobile browser release. Do not upload the earlier `sos-mobile-20261013-booking-parity.tar.gz`: that archive does not contain the new partner card.

## What changes

The Partner Dashboard's “Project Account Balance” card is replaced by the **same Project Account card used on the Accountant Dashboard**: live bank + cash account balance, posted cash movements, and posted net, all from the existing project statement and account balances. The partner card remains read-only. All prior mobile booking, receipt, sign-in, and dashboard changes remain in this complete frontend export.

This installation replaces only the mobile frontend at `/mobile/`. It does **not** restart the API, migrate the database, change customer records, replace the original web app at `/`, or create an Android APK.

The installer verifies the existing web/API release before touching Nginx, backs up the old mobile link and Nginx snippets, checks Nginx configuration, then verifies the new mobile HTML, JavaScript, font and image bytes plus API readiness. If verification after activation fails, it attempts to restore the previous routing automatically.

## 1. Windows PowerShell — upload

Download `sos-mobile-20261013-partner-account.tar.gz` from the attached asset card to Downloads. Use your existing PEM filename; change `SOS.pem` below if necessary.

```powershell
$Key = "$env:USERPROFILE\Downloads\SOS.pem"
$Archive = "$env:USERPROFILE\Downloads\sos-mobile-20261013-partner-account.tar.gz"
Test-Path $Key
Test-Path $Archive
Get-FileHash $Archive -Algorithm SHA256
scp -i "$Key" "$Archive" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$Key" ubuntu@3.111.185.116
```

Both `Test-Path` commands must return `True`. The expected SHA-256 is:

`{{SHA256}}`

## 2. EC2 SSH terminal — verify and install

Paste this **inside the EC2 SSH terminal**, not Windows PowerShell. Its fail-fast commands are inside a subshell, so a failure does not close your SSH session.

```bash
(
  set -eu
  cd /home/ubuntu
  echo "{{SHA256}}  sos-mobile-20261013-partner-account.tar.gz" | sha256sum -c -
  STAGE="$(mktemp -d /home/ubuntu/sos-mobile-partner-stage.XXXXXX)"
  tar -xzf sos-mobile-20261013-partner-account.tar.gz -C "$STAGE"
  sudo python3 "$STAGE/sos-mobile-20261013-partner-account/install.py" install
  echo "Keep this installer path for verify or rollback:"
  echo "$STAGE/sos-mobile-20261013-partner-account/install.py"
)
```

The checksum must print `OK`. Keep the **exact** printed `Routing backup` path and installer path. Do not rerun installation if it reports that this release directory already exists; use that release's installer with `verify` instead.

## 3. Verify EC2

```bash
curl --fail --silent --show-error https://sos.krishisetu9.in/mobile/release.json
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
curl --fail --silent --show-error https://sos.krishisetu9.in/release.json
sudo nginx -t
sudo systemctl is-active nginx
sudo systemctl is-active syndicateos-api
```

Expected mobile release: `sos-mobile-20261013-partner-account`.

Expected API: `status: ready`, `databaseReachable: true`, `targetVerified: true`.

Expected original web: `schema_version: 22`, `frontend_fix: sos-consolidated-20261013-registration-label`. Nginx and the API service should both say `active`. If the first request happens during an Nginx reload, retry the three `curl` commands after a few seconds; persistent failure is not normal.

## 4. Verify the screens

Hard-refresh https://sos.krishisetu9.in/mobile/ (Ctrl+Shift+R). As a partner, select the same firm/project as an accountant and check the Dashboard's **Project Account** card. It should show the same bank + cash balance, posted cash movements and posted net as the accountant's card; the partner cannot edit balances or approve entries. The original web remains at https://sos.krishisetu9.in/.

Do not create dummy financial transactions to verify a read-only card. An HTTP health response does not replace checking the actual partner screen.

## Rollback

If the new screen is wrong, use the **exact paths printed during installation**:

```bash
sudo python3 /home/ubuntu/sos-mobile-partner-stage.ACTUAL/sos-mobile-20261013-partner-account/install.py rollback /var/backups/syndicateos-mobile/ACTUAL-BACKUP
```

Replace `ACTUAL` and `ACTUAL-BACKUP` with the printed values. Do **not** execute the example placeholders unchanged. Rollback restores only the previous mobile routing and Nginx snippets, not customer data or financial history.

**Recommendation:** review this EC2 mobile version before starting the separate Expo Android APK build. A browser installation is not a native APK.
