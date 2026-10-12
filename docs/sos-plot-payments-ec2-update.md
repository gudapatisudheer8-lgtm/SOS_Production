# SyndicateOS — latest EC2 application update

Release: **sos-consolidated-20261013-plot-payments**
Target: the existing **sos-fresh-ec2-20261010** installation, including the already-installed **sos-consolidated-20261012** update.
Database: existing lowercase **sos** on RDS. Expected schema version: **21**.

This is an UPDATE, not a fresh installation. The web app and API must be updated together.
Do not run old stage/configure/initialize/activate commands, reset credentials, seed customer data, or delete the existing installation.
The promotional video is on hold and is not included. Resume it only when the user asks.
Replit Agent has not executed this update on EC2 or RDS.

## What this package contains

All changes from the previously deployed consolidated application remain included:

- Separate owner access; accountant/partner company-code access, profile menu and mandatory initial PIN changes.
- Accountant partner PIN reset, selected-project Edit, fresh Add Project, firm selector and saved capital-weighted equity.
- Edit Project uses the project creation layout, with the plot matrix and bank-account add/edit section.
- Preserve booked/sold inventory identities, account opening balances, private documents and the project Cash ledger.
- Combined sticky header; compact Edit and En/Te; firm before project; correctly aligned Add Partner.
- Simplified dashboards, partner investment/drawing/profit values, plot inventory and bank-plus-cash account balances.
- Remove duplicate project summaries, shortcut bars, unwanted tabs and floating unavailable-actions panels.
- Immediate recording of valid money entries without approval voting. Project Statement has the entry buttons, Enrolled By filter and sortable headings.
- Scrollable expense form with a separate submit/cancel footer.
- Refer Back creates a balanced reversal; the original author corrects and resubmits a linked replacement without rewriting financial history.
- Blueprint upload, private original document, manual/reviewed geometry and illustrative zoom/rotate 3D.
- Notification bell/feed and supported foreground browser notifications.

The new booking enhancement is entirely inside the existing **Fast Customer Booking** form:

- Reopen a booked plot to see the saved buyer, agreed rate/value, cumulative collected money, outstanding balance and receipt history.
- The agreed pricing is locked; a later receipt cannot change the existing buyer or negotiated rate.
- Enter only the amount received in this payment. Each receipt is saved separately and posts once to the selected bank/Cash ledger and statement.
- Reject overpayments and duplicate request retries; concurrent collections cannot exceed the outstanding amount.
- Saved receipts include payment date/reference, rate/area, agreed value, this payment, cumulative paid and balance after that receipt.
- Receipt sharing/copy and receipt-only printing, including the browser's Save as PDF option.
- Corrected/reversed receipts retain their historical values and annotations.
- A failed refresh after a successful save can recover the already-issued receipt rather than record the same payment twice.
- Recording money does not automatically mark a plot sold/registered.

Example: agreed price ₹15,00,000; first ₹1,00,000 receipt leaves ₹14,00,000.
A second ₹1,00,000 receipt makes cumulative paid ₹2,00,000 and remaining ₹13,00,000.

## Important limits

- Old advances that were never saved as posted receipts are not guessed or silently backfilled.
- Historical pending money remains unposted until its author explicitly corrects/resubmits it.
- Missing/ambiguous saved pricing requires reconciliation before further collection.
- Background browser push and native mobile push are not implemented. The bell and foreground notifications are not background push.
- AI blueprint extraction is not verified end-to-end; manual review remains available. EC2 needs its own securely configured provider, not Replit's proxy credentials.
- This package updates the EC2 web app and API, not an Expo native/app-store binary.
- Historical database audit records can retain approval labels; no active financial approval process is required and audit evidence is not deleted.

## Before installation

1. Schedule a short maintenance window; ask users to pause financial entries.
2. Take a fresh RDS snapshot as an additional precaution. Never restore/delete unrelated databases on the shared RDS instance.
3. Verify the archive's SHA-256 before extracting it. The accompanying handoff includes the hash inline, so a checksum sidecar is not required.
4. Keep `/etc/syndicateos/runtime.env`, the existing RDS CA, and `/var/lib/syndicateos/uploads`.
5. Required tools: Python 3, Java 21+, Nginx, systemctl, curl, psql, pg_dump and pg_restore.
6. pg_dump must be the same PostgreSQL major version as RDS or newer. The installer checks this before stopping services.
7. At the hidden prompt use the existing **sos_deploy database password**, not the owner password, partner PIN or sos_runtime password. Never share it in chat.
8. The installer requires explicit `UPDATE SOS` confirmation.

## Installer behavior

- Validates package checksums, known SOS paths, runtime database target, Java, Nginx and service flags before activation.
- Checks lowercase sos, the existing owner and successful migration history.
- Stops only syndicateos-api and creates a private sos schema dump plus an uploads archive.
- If backup validation fails, no migration is performed.
- Installs a separate versioned web/JAR directory; preserves the base release and the previous release.
- Runs the guarded upgrade-only migration path to V21. An existing V21 database has no new migration from this booking enhancement.
- Applies required runtime privileges without resetting business configuration or credentials.
- Preserves JVM limits, loopback binding, private uploads and disabled runtime migrations.
- Switches only the SOS routing snippet and reversible API systemd override.
- Verifies the actual API binary, readiness and HTTPS frontend marker, with bounded retries.

## Checks performed before handoff

The latest payment code passed 10 disposable-PostgreSQL integration checks and 8 form/helper checks, including cumulative payments, corrections, duplicate retries, locked pricing, linked bank receipts and concurrent overpayment protection.
The package preparation also runs the web type check/root-path production build, production API package build, and deployment-safety tests.
No authenticated production acceptance or live RDS mutation is implied by these local checks.
Complete the signed-in acceptance checklist after installation; readiness alone does not prove every screen.

## Verify after installation

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-plot-payments/update.py verify
sudo systemctl is-active syndicateos-api
sudo nginx -t
curl --fail --silent --show-error https://sos.krishisetu9.in/release.json
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
```

Expected frontend_fix: **sos-consolidated-20261013-plot-payments**.
Expected schema_version: **"21"**.
Expected readiness: **status = "ready"**, **targetVerified = true**.
The preserved base deployment.json is historical, not the active frontend marker.

Open a new private browser window:

- Accountant/partner: https://sos.krishisetu9.in/
- Owner: https://sos.krishisetu9.in/owner

## Signed-in acceptance checklist

- Existing logins, users, firms, projects and balances remain intact.
- Firm/project selectors, compact header, En/Te and navigation work.
- Add Project opens blank; Edit loads the selected project, plot matrix and bank section, saves and reloads.
- Existing documents remain downloadable; a rejected upload can be retried without creating a duplicate project.
- Add Partner placement, capital-weighted save and authorized PIN reset work. Do not reset customer PINs merely for testing.
- Dashboards and Project Statement agree on posted cash and bank balances.
- New valid expenses/investments/drawings record immediately with no approval voting.
- Filtering, sorting, CSV and author-only correction work without duplicating money.
- On a designated test plot/project, record a ₹1 lakh payment against a ₹15 lakh agreed price.
- Close and reopen the SAME Fast Customer Booking form: buyer/rate are locked, receipt is present, paid is ₹1 lakh and balance is ₹14 lakh.
- Record a second ₹1 lakh: paid becomes ₹2 lakh, balance ₹13 lakh, with two separate receipts and two ledger credits.
- Reject a payment above ₹13 lakh. A retry of the same request must not add another credit.
- View/share/print the saved receipts and confirm their historical balance-after-payment values.
- A correction to an additional receipt must reverse only that payment, not release the original booked plot.
- Do not enter fictitious payments into a real customer plot or bulk-resubmit uncertain historical entries.
- Confirm private blueprint/manual review and notification bell behavior. Background push and AI extraction are not acceptance claims.

## Failure and recovery

Keep the exact private backup directory printed by the installer.
It contains the sos dump, uploads archive, prior routing/override, runtime environment and state metadata.
It is root-only and contains sensitive customer data/credentials. Do not upload or share it.

- A failure before migration restores prior configuration and restarts the old API.
- Once the migration phase has begun, a failure restores prior routing/override but leaves SOS stopped for diagnosis.
- The installer does not automatically restore the database or delete financial history.
- Do not repeatedly run install after an error or start an older financial API without review.

Safe diagnostic commands:

```bash
sudo systemctl status syndicateos-api --no-pager
sudo journalctl -u syndicateos-api -n 100 --no-pager
sudo nginx -t
```

Do not print runtime.env, passwords or private backup contents. Redact customer details before sharing logs.

For a deliberate configuration rollback, replace the final argument with the EXACT backup directory printed during installation:

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261013-plot-payments/update.py rollback /opt/syndicateos-update-backups/EXACT_PRINTED_DIRECTORY
```

This restores routing/service configuration only and leaves the API stopped.
It does not restore the DB/uploads. Restoring a database dump would discard entries made after that backup.
Never restore the entire shared RDS instance just to undo SOS.
If installation did not create the versioned directory, use update.py from the verified extracted archive.
