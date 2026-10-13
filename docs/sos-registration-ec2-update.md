# SyndicateOS — registration and navigation update

Release: **sos-consolidated-20261013-registration**
Target: the existing EC2 SOS installation, currently using **sos-consolidated-20261013-plot-payments**.
Database: existing lowercase **sos** on RDS. Required migration version after installation: **22**.

This updates the matched web app and API together. It is NOT a fresh installation.
All previous application changes, cumulative payments, locked pricing and saved receipts are retained.
Do not run old stage/configure/initialize/activate commands, reset users/PINs, seed customer data or overwrite a previous checksummed release.
No live EC2/RDS update has been executed by Replit Agent.
The promotional video remains on hold.

## The two latest changes

### Registration scheduling and reminders — inside the existing form

- Selecting Registration Slot Booked reveals date, time, location and editable reminder settings inside Customer Plot Collections.
- Schedule, reopen, edit and cancel an appointment independently of collecting another payment.
- Calendar/time inputs use India time, Asia/Kolkata. Stored appointments survive API restarts.
- Recommended reminders: 1440 minutes (one day) and 60 minutes (one hour) before registration.
- Already-passed lead times are skipped; cancelled/replaced appointments invalidate old reminders.
- Assigned project accountants and partners receive recipient-specific bell notifications with project, plot number, date, time and location.
- Notification links open the same authorized plot form, with sign-in if required.
- Appointment saving does not create a payment/receipt, change agreed prices/buyers, introduce approvals or automatically mark a plot sold/registered.
- A persisted scheduler and push outbox handle due reminders and bounded retries.
- Background browser push is implemented but requires valid push keys, a supported browser and explicit subscription.

### Sticky module navigation — both dashboards

- Dashboard, Partners & Equity, Open Plotting and Project Statement navigation stays visible under the shared accountant header.
- Partner Dashboard, Plots and Project Statements navigation stays visible under its shared header.
- The offset follows the measured header height, including responsive layouts; existing tabs, dropdowns and modals retain their stacking and behavior.

## What does not require AI keys

Registration reminders use saved appointment data. They do NOT need OpenAI API tokens.
Bell reminders work without browser-push keys; background browser alerts need VAPID keys and permission.
Native mobile-app push/app-store publication is not included. On iPhone/iPad, browser push requires a compatible installed Home Screen web app.
Actual closed-tab/device delivery has not been proven with your production keys. Browser/OS policy can suppress or delay a notification even after the provider accepts it.

## Before installation

1. Schedule a short maintenance window and ask users to pause financial entry.
2. Take a fresh RDS snapshot as an additional precaution. Do not restore or alter unrelated databases on the shared RDS instance.
3. Verify this archive's SHA-256 BEFORE extracting/executing it. Use the current filename and inline hash in this guide's handoff.
4. Preserve `/etc/syndicateos/runtime.env`, the existing RDS CA and `/var/lib/syndicateos/uploads`.
5. Required tools: Python 3, Java 21+, Nginx, systemctl, curl, psql, pg_dump and pg_restore.
6. pg_dump must match or exceed the RDS PostgreSQL major version. The updater checks this before stopping services.
7. At the hidden prompt use the existing sos_deploy DATABASE password, not an owner password, partner PIN or sos_runtime password.
8. Confirm installation by typing UPDATE SOS.

## Installation safety

The updater validates checksums, known SOS service/routing paths, runtime database target, current owner and successful migration history.
It stops only syndicateos-api, creates and validates a private sos schema dump plus private uploads archive, then installs a separate versioned release.
V22 adds registration metadata, jobs, recipient notification support and push subscriptions/outbox. It does not reset existing money, credentials or firm assignments.
V1–V21 remain unchanged. Existing runtime-role privileges are extended to the added storage without granting migration-history writes.
The original base installation and previous update directory remain intact.
Guarded migration runs with business writes disabled; the regular API workers resume with the existing production write configuration.
The updater checks the actual API binary, readiness and served HTTPS frontend with bounded retries.

## Verify the installed update

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-registration/update.py verify
sudo systemctl is-active syndicateos-api
sudo nginx -t
curl --fail --silent --show-error https://sos.krishisetu9.in/release.json
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
curl --fail --silent --show-error -I https://sos.krishisetu9.in/registration-push-sw.js
```

Expected frontend_fix: **sos-consolidated-20261013-registration**.
Expected schema_version: **"22"**.
Expected readiness: status **ready**, targetVerified **true**.
The service-worker URL must return JavaScript, not the SPA HTML fallback. Permit same-origin workers and HTTPS egress to supported push-provider endpoints.
The preserved base deployment.json is historical, not the active release marker.

## Optional background-browser push setup

If keys are already configured, retain the same pair. Do not generate new keys on each update.
Do not put secrets in chat, Git, public assets, deployment archives or shared logs.

The package includes a public generator script. It requires Node 20+ on the trusted machine where you generate keys.
On EC2, first check `node --version`. If Node is unavailable, generate using the same script on another trusted Node-equipped computer and transfer the three settings securely; missing Node does not block the application update or bell reminders.

To generate ONCE on EC2, with keys written to a root-only file and never printed:

```bash
sudo node /opt/syndicateos/releases/sos-consolidated-20261013-registration/generate-web-push-credentials.mjs \
  /root/sos-web-push.env \
  https://sos.krishisetu9.in
```

The HTTPS URL is the non-secret VAPID contact subject; a business mailto: address can be used instead.
The generator refuses to overwrite an existing file. If the file already exists, retain it rather than deleting it or rotating keys.

Using a private trusted editor, copy ONLY these three settings from the generated file into the existing runtime environment:

- SOS_WEB_PUSH_PUBLIC_KEY
- SOS_WEB_PUSH_PRIVATE_KEY
- SOS_WEB_PUSH_SUBJECT

```bash
sudoedit /root/sos-web-push.env
sudoedit /etc/syndicateos/runtime.env
sudo chown root:root /etc/syndicateos/runtime.env
sudo chmod 600 /etc/syndicateos/runtime.env
sudo systemctl restart syndicateos-api
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-registration/update.py verify
```

Do NOT replace runtime.env with the generated file: that would remove existing database/session settings.
Avoid duplicate SOS_WEB_PUSH entries; keep all other environment settings unchanged.
Keep a secure backup of the key pair. Replit Secrets and Preview subscriptions do not transfer automatically to EC2 or its production origin.

## Signed-in acceptance — after installation

Open a new private browser window at https://sos.krishisetu9.in/ and sign in with an existing authorized account.

1. Check existing users, firms, projects, bank/Cash balances, agreed pricing and saved receipts remain intact.
2. On both dashboards, scroll through long pages and confirm the module bar stays below the header without obscuring content or forms.
3. On a designated test booking, select Registration Slot Booked and enter a future date, India time, location and reminder lead times.
4. Choose Save registration slot only. No new payment or zero-value receipt should appear; balance and agreement pricing must be unchanged.
5. Close/reopen the same plot form and verify the appointment. Check a second authorized project accountant/partner sees the saved details and bell notification; unrelated users must not receive it.
6. Edit the time/location and then cancel a test appointment. Obsolete reminders must not arrive. Correcting an additional payment must not cancel the original booking/appointment.
7. With configured keys, open the bell on each user's own device, choose Enable / repair background alerts and grant browser permission. Confirm subscribed status, not just permission.
8. For a background test, schedule registration ten minutes ahead with a five-minute reminder, then close all application tabs and wait for the due reminder. Opening it must return to the same authorized plot form.
9. Each accountant/partner device must subscribe separately. Do not test fictitious money or reset customer PINs on live records.

Workers run inside the API process, starting after 30 seconds and polling approximately every 15 seconds.
No separate cron service is required. The API must remain running and outbound HTTPS must be permitted.
Expired jobs do not issue stale reminders after the registration start time.
Bell entries remain available if permission, keys or provider delivery are unavailable.

## Failure and recovery

Keep the EXACT private backup directory printed by this installation.
It contains sensitive database/upload backups and prior environment/routing/service state; never upload/share it.

- Before migration starts, a failure restores prior configuration and restarts the previous API.
- Once migration starts, a failure restores prior routing/override but leaves the API stopped for diagnosis.
- Do not repeatedly retry install, start an older financial API blindly, drop tables or automatically restore customer data.
- The updater does not restore the database automatically.

Safe diagnostic commands:

```bash
sudo systemctl status syndicateos-api --no-pager
sudo journalctl -u syndicateos-api -n 100 --no-pager
sudo nginx -t
```

Never print runtime.env or private keys. Redact customer details before sharing logs.

Deliberate CONFIGURATION rollback, using the exact printed backup path:

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-registration/update.py rollback /opt/syndicateos-update-backups/EXACT_PRINTED_DIRECTORY
```

This restores routing/service configuration only and leaves the API stopped.
It does not restore the DB/uploads. Restoring a dump would discard entries after its backup; never restore the entire shared RDS instance merely to undo SOS.
If the versioned directory was not installed, use update.py from the verified extracted archive.
