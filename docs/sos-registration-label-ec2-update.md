# SyndicateOS — registration-slot plot label update

Release: **sos-consolidated-20261013-registration-label**

This package updates the current web application and API together. It is intended for the existing SOS installation, including the successfully installed sos-consolidated-20261013-registration release.

## What changes

- On the accountant and partner plot grids, an active saved registration appointment replaces Token Booked with **Slot booked for registration** in purple.
- The label uses the saved appointment state, not merely the agreement-stage dropdown.
- Cancelling the appointment restores Token Booked. Sold plots retain Sold.
- The API returns the saved appointment state in the existing project snapshot. No extra per-plot requests are required.
- Registration scheduling, reminders, sticky navigation, cumulative plot payments, locked prices, payment history and receipts remain included.
- Plot booking status, financial postings, balances and inventory counts are unchanged by the new label.
- No new database migration: an existing V22 installation remains at V22. The installer validates the existing migrations and applies no pending migration on that installation.
- Promotional video and native mobile push work are not included.

## Before installation

Recommendation: take a fresh RDS snapshot and schedule a short maintenance window. Ask users to pause financial entries.

Use only this release's archive and checksum from the download/install instructions above. Do not reinstall the old archive expecting this label.

Required tools remain Python 3, Java 21+, Nginx, systemctl, curl, psql, pg_dump and pg_restore. The updater checks compatibility before stopping services.

At the hidden password prompt, enter the existing **sos_deploy database password**, not a partner PIN or owner password. Confirm with **UPDATE SOS**.

The updater stops only syndicateos-api, backs up the SOS database schema and private uploads, installs the API and frontend in a separate versioned directory, and verifies the active binary and HTTPS frontend. Preserve the private recovery path printed during installation.

Existing runtime settings, credentials, firm assignments, uploads and financial records are preserved. The previous release remains intact. Do not change database names or run fresh-install commands.

## Verify after installation

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-registration-label/update.py verify
sudo systemctl is-active syndicateos-api
curl --fail --silent --show-error https://sos.krishisetu9.in/release.json
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
```

Expected frontend_fix: **sos-consolidated-20261013-registration-label**.

Expected schema_version: **"22"**.

Expected service: **active**.

Expected readiness: **ready**, databaseReachable **true**, targetVerified **true**.

The release field sos-fresh-ec2-20261010 identifies the preserved base installation; frontend_fix identifies this active update.

## Signed-in visual acceptance

Local verification before packaging: frontend type checking, six server-rendered component tests, and fourteen disposable-database integration tests passed. These check both roles' appointment-state projection, cancellation, badge precedence and financial regressions. They are not a claim of live production push delivery.

After deployment:

1. Hard-refresh the application on the real HTTPS site.
2. As accountant, open the plot with an existing active registration appointment: its top badge must show Slot booked for registration in purple.
3. As an assigned partner, open the same project: the same badge must appear.
4. Ordinary reserved plots still show Token Booked. Sold plots still show Sold.
5. If testing cancellation, use a designated test appointment only: cancellation restores Token Booked without changing payment history, balance or booking ownership.
6. Scheduling or editing an appointment must use Save registration slot only, never a fictitious payment.
7. Keep the navigation-bar and existing cumulative-payment checks from the previous release.

## Browser push settings

If VAPID keys are already configured in /etc/syndicateos/runtime.env, retain the same pair and subject. Do not regenerate keys for this label update. Existing browser subscriptions depend on that pair.

Bell reminders do not require push keys. Background browser alerts still require SOS_WEB_PUSH_PUBLIC_KEY, SOS_WEB_PUSH_PRIVATE_KEY and SOS_WEB_PUSH_SUBJECT on EC2, followed by each user enabling background alerts in their browser. No OpenAI token is needed.

If not yet configured, the package retains generate-web-push-credentials.mjs. Use a trusted Node 20+ machine; Node is optional for the application installation itself.

On EC2, only if keys do not already exist and Node is available:

```bash
sudo node /opt/syndicateos/releases/sos-consolidated-20261013-registration-label/generate-web-push-credentials.mjs /root/sos-web-push.env https://sos.krishisetu9.in
sudoedit /root/sos-web-push.env
sudoedit /etc/syndicateos/runtime.env
```

Privately copy only the three SOS_WEB_PUSH entries into the existing runtime file, without duplicate entries. Do not replace runtime.env with the generated file: that would remove existing database/session settings. The generator refuses to overwrite an existing output file and does not print keys.

```bash
sudo chown root:root /etc/syndicateos/runtime.env
sudo chmod 600 /etc/syndicateos/runtime.env
sudo systemctl restart syndicateos-api
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-registration-label/update.py verify
```

Never put private keys, passwords or runtime.env contents in chat or shared logs. Replit secrets do not automatically transfer to EC2.

Each user should use a regular supported browser window, not private/incognito mode, click Enable / repair background alerts in the bell and grant permission. Test closed-tab delivery using a designated test appointment and a future reminder. Actual delivery depends on browser/OS policy and has not been proven by the label tests.

## Failure and recovery

If installation or verification fails, stop and share only the error output, never private settings or credentials. Do not manually restart an older API against an unverified schema.

The private recovery directory contains database/upload backups and the previous routing/service configuration. The updater's rollback restores only configuration, leaves the API stopped, and never automatically restores the database or uploads.

Only after reviewing the failure and choosing the correct private recovery directory:

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-registration-label/update.py rollback --backup /opt/syndicateos-update-backups/EXACT_PRINTED_DIRECTORY
```

Do not delete either release directory or any recovery backup until production acceptance is complete.
