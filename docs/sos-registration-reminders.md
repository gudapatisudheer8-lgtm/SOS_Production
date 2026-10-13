# Registration reminders and sticky navigation

## Scope and safety

Registration controls remain in Customer Plot Collections. Saving, editing and cancelling use a separate authenticated registration endpoint, not `erp.save` for bookings. They never create a payment, receipt, posting, approval, buyer change, price change or sold transition. The saved agreement stage becomes Registration Slot Booked only after an explicit appointment save.

The appointment uses India time, Asia/Kolkata; PostgreSQL stores its absolute UTC instant. Recommended reminders are editable 1440 and 60 minutes before. Passed lead times are skipped when scheduling. A persisted due job may catch up after an API restart only while the appointment is still in the future. After registration starts, it expires rather than issuing an old reminder.

Booking release through the existing Refer Back flow and explicit registered/sold completion invalidate pending reminders. Correcting an additional payment does not cancel registration. No registration identity documents or buyer identity are included in push payloads. Location and project/plot/date/time are visible on the device notification screen; users should enable push only on their own devices.

## Additive migration and worker

V22 adds registration metadata, idempotency history, persisted reminder jobs, recipient-specific bell entries, browser subscriptions, push outbox and a database-owned registration policy. V1–V21 are unchanged. There are no new operational/example records and no firm release reassignment.

Both workers run within the API process, polling every 15 seconds after an initial 30-second delay. Two scheduler threads prevent slow push-provider calls from blocking reminder generation. The same project transaction lock serializes appointment edits, release/completion, reminder generation and push dispatch. Duplicate workers use row locks and stable job/notification identifiers. Bell entries commit before push attempts; failed push does not remove the bell notification. The push outbox permits five bounded attempts with backoff; expired and invalidated jobs never deliver. Provider 404/410 disables the dead subscription. HTTP timeouts are five seconds. Delivery errors are visible under the bell when it is reopened.

Optional process settings: `sos.registration-poll-ms`, `sos.push-poll-ms`, `sos.registration-initial-delay-ms`, `sos.push-initial-delay-ms`. Workers require the existing approved database/write gate. Do not run a separate duplicate cron or client-only scheduler.

## Browser-push credentials

The implementation uses encrypted standard Web Push and VAPID, not polling notifications or native push. It requires a valid P-256 VAPID key pair and an operations contact:

- `SOS_WEB_PUSH_PUBLIC_KEY` — URL-safe uncompressed P-256 public key
- `SOS_WEB_PUSH_PRIVATE_KEY` — URL-safe P-256 private scalar; secret
- `SOS_WEB_PUSH_SUBJECT` — `mailto:` operations contact or an HTTPS contact URL

Generate once on a trusted machine using Node 20 or later:

```sh
node scripts/ec2/generate-web-push-credentials.mjs /secure/owner-only/push.env mailto:YOUR_OPERATIONS_ADDRESS
```

This refuses to overwrite an existing file and writes with mode 0600, without printing credentials. For Replit Preview, import the values through the secure Secrets interface; never paste them into chat. For EC2, have the operator add them to `/etc/syndicateos/runtime.env` using a secure editor, retaining root ownership and mode 0600. Do not include the generated file in an archive, Git, the frontend, logs or documentation. Keep the same pair across API restarts/upgrades; key rotation requires browser resubscription.

Only the public key is returned by the authenticated configuration endpoint. The private key is server-only. Missing/invalid credentials produce an explicit unavailable state. A granted browser permission alone does not mean subscribed or delivered.

## EC2 handoff — NOT deployed by this task

Use a uniquely named consolidated release; do not overwrite a previously supplied archive. Build the frontend with `BASE_PATH=/`, package the current API JAR including V22, and use the updated guarded updater plus runtime permissions SQL. `scripts/ec2/build-consolidated-update.py` and `consolidated-update.py` now expect V22. The existing production deployment task can incorporate this change; do not contact EC2/RDS from Preview.

Preserve the existing owner, data, credentials, upload backup and firm assignments. Review the package's migration/checksum manifest before installation. V22 has no activation/reassignment step. After installation, add push credentials securely, restart `syndicateos-api`, confirm the configured push status, and subscribe an authorized test accountant/partner on the actual HTTPS production origin.

The static `registration-push-sw.js` must be served at the web app base path (Preview: `/syndicateos-web/registration-push-sw.js`; EC2 root: `/registration-push-sw.js`) with JavaScript content type, not an SPA HTML fallback. Permit service workers, push endpoint HTTPS egress (FCM, Mozilla, Apple and Windows notification services), and ensure Content Security Policy allows a same-origin worker. No change to Nginx proxy routes should be needed on the existing static root deployment. Credentials/subscriptions are origin-specific; a Preview subscription is not a production subscription.

## Honest enablement and acceptance

Open the bell and choose Enable / repair background alerts. Permission is requested only after that action. If unsupported, blocked, missing credentials, provider failure or subscription failure occurs, the bell remains usable and shows the reason. On iPhone/iPad, Web Push requires the installed Home Screen web app and compatible OS/browser. Native app-store push is not part of this release. Sign-out disables this browser subscription before clearing the session to avoid shared-device account leakage.

With real credentials on the intended origin, verify a future appointment with a short reminder, then close every app tab and wait for the background service-worker notification. Clicking it should sign in if needed and open the same authorized plot form. Browser/OS settings can delay or suppress delivery: a successful provider response means accepted, not proof that the device displayed it.

Automated disposable-database tests cover India-time conversion, invalid/past input, payment/posting/receipt invariance, optimistic revisions, idempotency, recipient/project/firm isolation, persisted restart recovery, editing/cancellation, completion/release invalidation and deduplication. An actual closed-tab push delivery still requires a supported browser, explicit subscription and configured VAPID keys.
