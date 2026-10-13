# SyndicateOS mobile — EC2 deployment

Release: sos-mobile-20261013

This installs the latest mobile browser frontend at https://sos.krishisetu9.in/mobile/ alongside the existing web application at https://sos.krishisetu9.in/.

EC2 serves the public mobile web export and the existing Java API. It does not turn that frontend into an APK. The native APK will be built separately through Expo/EAS afterward, using the same production API.

## Included

- Current accountant and partner mobile dashboards, compact firm/project selectors and Edit.
- Clean Dashboard, Partners & Equity, Open Plotting and Project Statement without the unwanted appended legacy forms, booking lists or audit filter panel.
- Statement dropdown filters, sorting and clearly accessible Refer Back.
- Accurate recorded, referred-back and replaced-history explanations; correction is original-author-only.
- Investment, Expenses and Drawing Request side by side on the partner statement.
- Bold SOS/OS headers and matching orange SOS welcome, icon and configured splash branding.
- Existing mobile booking collections and receipts.

No web root replacement, API binary update, database migration, new approvals or customer-record mutation. Existing credentials, uploads, web push keys and financial history remain in place. Native registration/reminder parity and native background push are separate work; this deployment does not activate them. Promotional MP4 is not installed on EC2.

## Before installing

Recommendation: retain a recent RDS snapshot as part of normal deployment practice. This package does not write the database or stop the API. It backs up Nginx routing and the previous mobile target before activation.

Required existing baseline: schema 22, web release sos-consolidated-20261013-registration-label, with /etc/nginx/snippets/syndicateos-fresh.conf active inside the existing HTTPS server. Installer stops if the baseline changed, if /mobile is already managed by unrelated configuration, or if checksums differ.

Required tools: Python 3.9+, Nginx, systemctl, curl and tar. No Node, pnpm, Java upgrade or Expo installation is needed on EC2 for this static package.

Download the archive from the provided card to your Windows Downloads folder. Use the exact filename, not an older release.

## 1. Windows PowerShell — upload

Adjust only the PEM path if your SSH key is elsewhere:

```powershell
$Key = "$env:USERPROFILE\Downloads\SOS.pem"
$Archive = "$env:USERPROFILE\Downloads\sos-mobile-20261013.tar.gz"
Test-Path $Key
Test-Path $Archive
Get-FileHash $Archive -Algorithm SHA256
scp -i "$Key" "$Archive" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$Key" ubuntu@3.111.185.116
```

Expected SHA-256: {{SHA256}}

Do not paste the PEM contents or passwords into chat. If either Test-Path returns False, correct that path before running scp.

## 2. EC2 SSH terminal — verify and install

The parentheses keep fail-fast behavior inside a subshell rather than closing your SSH session.

```bash
(
  set -eu
  cd /home/ubuntu
  echo "{{SHA256}}  sos-mobile-20261013.tar.gz" | sha256sum -c -
  STAGE="$(mktemp -d /home/ubuntu/sos-mobile-stage.XXXXXX)"
  tar -xzf sos-mobile-20261013.tar.gz -C "$STAGE"
  sudo python3 "$STAGE/sos-mobile-20261013/install.py" install
  echo "Keep this installer path for verification/rollback:"
  echo "$STAGE/sos-mobile-20261013/install.py"
)
```

Keep the printed Routing backup directory and installer path. Install copies public files into /opt/syndicateos/mobile-releases/sos-mobile-20261013, switches mobile-current, adds a separate mobile Nginx include and validates Nginx before reloading it. The existing web/API routes and SSL settings are not replaced.

If validation after activation fails, routing is restored automatically. Do not retry with a fresh-install command or edit database settings.

## 3. Verify

```bash
curl --fail --silent --show-error https://sos.krishisetu9.in/mobile/release.json
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
curl --fail --silent --show-error https://sos.krishisetu9.in/release.json
sudo nginx -t
sudo systemctl is-active nginx
sudo systemctl is-active syndicateos-api
```

Expected mobile release: sos-mobile-20261013. Existing web frontend_fix must remain sos-consolidated-20261013-registration-label. API must show status ready, databaseReachable true and targetVerified true.

The installer also verifies actual JavaScript, font and image bytes, including pnpm export paths; successful HTML alone is not sufficient.

## 4. Open both versions

Web: https://sos.krishisetu9.in/

Mobile browser version: https://sos.krishisetu9.in/mobile/

Sign in with the existing company code and accountant/partner credentials. The accounts and records are shared, not a second database. Review both roles and switch firms/projects. Check the new branding, three side-by-side statement actions and absence of the removed sections.

For referred-back entries, only the original enrolling author can correct and resubmit. The accountant cannot resubmit someone else's entry. Use designated test records for financial acceptance checks; do not invent payments on a customer booking.

## Rollback if needed

Use the exact paths printed during install:

```bash
sudo python3 /home/ubuntu/sos-mobile-stage.ACTUAL/sos-mobile-20261013/install.py rollback /var/backups/syndicateos-mobile/ACTUAL-BACKUP
```

Replace ACTUAL and ACTUAL-BACKUP with the printed values. Do not execute these placeholders unchanged. Rollback restores the previous mobile link and Nginx snippets without restoring, clearing or changing customer data.

If install says the same release already exists, run that release's installer with verify instead of install. Never overwrite a checksummed release directory.

## After EC2: APK

After the mobile URL is verified, prepare an Expo Android APK build with a permanent Android application identifier, an APK build profile, the production API domain sos.krishisetu9.in and signing managed securely through Expo/EAS. Do not embed database credentials or session secrets in the APK.

The configured launcher icon and full native splash require a new native build. Expo Go's own loading overlay is not the standalone splash. An APK is not an iOS app, and this package does not claim native background notification delivery.
