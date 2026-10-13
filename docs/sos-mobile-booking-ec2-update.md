# SyndicateOS — mobile booking-form EC2 update

Release: sos-mobile-20261013-booking-parity

Install this NEW archive, not sos-mobile-20261013.tar.gz. The earlier archive does not contain the latest changes.

## Included in this update

- Removes “Use previous credential” from the mobile welcome/client sign-in screen. The mandatory PIN-change security flow remains.
- Updates the existing native mobile booking/collections form to follow the current web form layout and configuration.
- Configured payment-mode, deposit-account and agreement-stage dropdowns, account selection defaults, account balances and saved bank details.
- First payment locks buyer and price; later collections use the authoritative cumulative summary and a blank next-payment amount.
- Automatic outstanding-after-payment calculation, maximum payable, inline floor and amount errors, and invalid/future-date protection.
- History, customer receipts and safe request recovery; an accepted payment with a failed refresh cannot silently become a new payment request.
- The ₹15 lakh example: first ₹1 lakh leaves ₹14 lakh; second ₹1 lakh leaves ₹13 lakh.
- Phone-readable balances, real saved plot measurements (no invented dimensions or road widths), scrollable form and fixed action footer.
- All earlier mobile dashboard, statement and branding changes remain included.

Financial entries and customer data are not migrated or altered by installation. This is a mobile-only frontend update: the existing web app at / and Java API remain unchanged. Registration appointment actions remain separate from payments. This does not activate native background push or create an APK.

Local verification before packaging: 25 mobile regression checks and typecheck passed. A single browser pass verified the form with intercepted in-memory payments at phone/tablet sizes. These are not proof of native-device behavior or live financial posting; no production customer payments were made.

## Before installation

Recommendation: keep a current RDS snapshot as normal deployment protection. This update makes no database writes or schema changes and does not restart the API.

Existing baseline: schema 22 and web frontend_fix sos-consolidated-20261013-registration-label. The existing mobile version may be sos-mobile-20261013. The installer validates the exact recorded web/API baseline before changing routing, preserves both versions in separate release directories and backs up the old mobile target plus Nginx snippets.

The existing /etc/nginx/snippets/syndicateos-fresh.conf must be active in your HTTPS server. The installer stops rather than guessing if this differs.

Required tools: Python 3.9+, Nginx, systemctl, curl, tar. No Node, Expo or pnpm installation is required on EC2.

## 1. Windows PowerShell — upload

Download sos-mobile-20261013-booking-parity.tar.gz into Downloads. Use your existing PEM filename; change SOS.pem below if necessary.

```powershell
$Key = "$env:USERPROFILE\Downloads\SOS.pem"
$Archive = "$env:USERPROFILE\Downloads\sos-mobile-20261013-booking-parity.tar.gz"
Test-Path $Key
Test-Path $Archive
Get-FileHash $Archive -Algorithm SHA256
scp -i "$Key" "$Archive" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$Key" ubuntu@3.111.185.116
```

Both Test-Path results must be True before proceeding.

Expected SHA-256: {{SHA256}}

## 2. EC2 SSH terminal — verify and install

Paste the following in the EC2 terminal, not PowerShell. The parentheses keep failures inside a subshell without ending your SSH session.

```bash
(
  set -eu
  cd /home/ubuntu
  echo "{{SHA256}}  sos-mobile-20261013-booking-parity.tar.gz" | sha256sum -c -
  STAGE="$(mktemp -d /home/ubuntu/sos-mobile-booking-stage.XXXXXX)"
  tar -xzf sos-mobile-20261013-booking-parity.tar.gz -C "$STAGE"
  sudo python3 "$STAGE/sos-mobile-20261013-booking-parity/install.py" install
  echo "Keep this installer path for verify/rollback:"
  echo "$STAGE/sos-mobile-20261013-booking-parity/install.py"
)
```

Expected checksum: OK. Keep the printed Routing backup directory and installer path.

The new public files go to /opt/syndicateos/mobile-releases/sos-mobile-20261013-booking-parity. The installer atomically changes mobile-current, tests Nginx, reloads only Nginx and verifies the mobile release and actual HTML/JavaScript/font/image bytes. It also checks that the existing web release and API readiness remain unchanged. If post-activation verification fails, it attempts to restore previous mobile routing automatically. Do not run fresh-install commands or change database credentials.

## 3. Verify

```bash
curl --fail --silent --show-error https://sos.krishisetu9.in/mobile/release.json
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
curl --fail --silent --show-error https://sos.krishisetu9.in/release.json
sudo nginx -t
sudo systemctl is-active nginx
sudo systemctl is-active syndicateos-api
```

Expected mobile release: sos-mobile-20261013-booking-parity.

Expected API: status ready, databaseReachable true and targetVerified true.

Expected original web: frontend_fix remains sos-consolidated-20261013-registration-label and schema_version remains 22.

Both services should be active.

## 4. Check the actual screens

Hard-refresh https://sos.krishisetu9.in/mobile/ (Ctrl+Shift+R on Windows). On a phone, close and reopen the page or reload it.

- Welcome/client sign-in: “Use previous credential” must be absent.
- Accountant → Open Plotting → available plot: the new form must show configured dropdowns, max payable, date/calendar, read-only booking status, agreement stage and fixed footer.
- Open an existing booked plot: buyer/rate must be locked; collected and outstanding totals and receipt history must appear; the next-payment amount must start empty.
- An amount above outstanding must show an error and must not post.
- Check as a partner that the current account's server permissions are retained; no approval controls are introduced.

Do not make dummy payments against real customer plots to test the update. Use designated test records and keep any financial acceptance test coordinated.

Original web remains available at https://sos.krishisetu9.in/.

## Rollback

Use the exact installer and backup paths printed during installation:

```bash
sudo python3 /home/ubuntu/sos-mobile-booking-stage.ACTUAL/sos-mobile-20261013-booking-parity/install.py rollback /var/backups/syndicateos-mobile/ACTUAL-BACKUP
```

Replace ACTUAL and ACTUAL-BACKUP with the printed values; do not run placeholders unchanged. This restores the previous mobile target and Nginx routing, not customer data or financial history.

If the installer says the same release already exists, use its verify command rather than overwriting that release directory.

## After deployment

Review the updated EC2 mobile version first. Build the standalone Android APK through Expo/EAS afterward using production API domain sos.krishisetu9.in, with the native build configuration (not the /mobile web-export base path). Native icon/splash and installed-device behavior require the actual APK build; EC2 installation alone does not verify them.
