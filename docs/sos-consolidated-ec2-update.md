# SyndicateOS — consolidated EC2 update

Release: **sos-consolidated-20261012**  
Target: the existing **sos-fresh-ec2-20261010** installation.  
Database: **lowercase `sos`**, on your existing RDS host.  
Expected migration version after installation: **21**.

This is an update, NOT a fresh install. Do not run the old `stage`, `configure`,
`initialize` or `activate` commands. Do not reset the database, owner, PINs, or firm
configuration. No live EC2/RDS deployment was executed by Replit Agent.

## Included changes

### Owner and access
- Existing firm profile/code changes save through the backend, with conflict/error reporting.
- Accountant and partner login after initial PIN changes; separate owner-only login remains.
- Profile menu with Change PIN and Sign out; notifications stay in the shared header.
- Accountant partner PIN reset: one-time temporary six-digit PIN, shown once, requiring a change at next login.
- Existing credentials and company-code access boundaries are preserved. A selector never grants access to another firm.

### Accountant project setup
- Firm selection, selected-project Edit, and a genuinely fresh Add Project form.
- Edit uses the Add Project UI, including the directional plot matrix and bank-account section.
- Add a bank account or edit existing bank metadata from Edit Project.
- Saved project data is validated against its actual sector/release and optimistic revision.
- Preserve booked/sold plot identities and their financial history. Plot reductions affect only eligible unused inventory, with confirmation.
- Preserve account opening balances and the default Cash ledger; no recreation of live financial records.
- Project creation retains its draft across rejected attachment retries; validates file types/size before persistence.
- Remove the duplicate Plans & Documents dashboard block. Saved private documents/downloads and uploads stay in project setup.
- Capital-weighted equity mode saves to the server.

### Dashboard simplification
- One combined sticky header, preserving firm/project selection, profile and bell.
- Context caption below the firm name; no duplicate project context banner.
- Accountant controls: Firm → Project → Edit → Add Project. Compact Edit label.
- Firm dropdowns open even if only one authorized firm exists.
- Partner language switch: En / Te, with full-language accessible labels/tooltips.
- Add Partner is aligned at the top-right of Partner & Equity, with equity controls below.
- Remove the crossed duplicate project summary, redundant KPI cards and shortcut bars.
- Accountant cost card includes partner names/shares; plot and account cards navigate to their respective modules.
- Project Account shows bank + cash net balance and cash-movement breakdown, without redundant account buttons.
- Partner dashboard retains the compact personal investment/drawing/profit values, plus project-wide plot counts and bank/cash balance.
- Simplified navigation; remove separate project-account/expense-approval tabs and partner investment-history/drawing-approval tabs.
- Remove the floating “Show unavailable actions” panel from every web dashboard.

### Project Statement and financial corrections
- Expenses, investments, drawings and received booking money post immediately after a valid save. No financial approval/sign-off process.
- Project Statement entry buttons: expenses, investment, and role-appropriate drawing entry/request.
- Remove Record Bank Tx, Approver Name, Status columns and approval filters.
- Expense form has a bounded scrollable body and a separate, wrapping submit/cancel footer.
- Refer Back requires a reason and appends a balanced reversal; it does not overwrite/delete the original.
- The original author uses Correct & Resubmit on the same screen to create a linked replacement.
- Revisions, duplicate-request protection, account/firm/project access, sufficient funds, and linked booking guards remain enforced.
- Account balances, posted totals and inventory follow the server's posted journal, not browser-only status flags.
- Historical pending money is NOT automatically posted by migration. Its author must explicitly correct/resubmit it.
- Enrolled By dropdown plus sortable Date, Voucher/Reference, Narration, Account, Enrolled By and Amount headings.
- Clear Filters resets all filters; filtering/sorting cannot mutate journals or running balances.
- Marketing requests no longer require financial review/sign-off; received money is recorded explicitly.

### Blueprints and notifications
- Upload blueprint in Open Plots, retain the original private document, and inspect the selected project's plan.
- Reviewed draft geometry records plot numbers/facing and road widths; confirmed geometry supports an illustrative zoom/rotate 3D view.
- Manual review/tracing is available; measurements are not invented and geometry does not change booked plots or money.
- Customer Presentation Mode removed. Project layout values come from saved project data.
- Persistent notification bell/feed, read/unread tracking and foreground browser notifications where supported and permitted.

## Important limits — not represented as completed

- **Background browser push and native mobile push are not implemented.** The bell/feed and foreground browser notifications are included; they are not background push.
- **AI blueprint extraction is not verified end-to-end.** The provider gateway failed earlier image extraction checks. The manual reviewed workflow remains available; provider failures are shown explicitly.
- The EC2 server does not inherit Replit's AI integration credentials. AI extraction needs a separately and securely configured OpenAI-compatible provider (`SOS_BLUEPRINT_AI_BASE_URL`, `SOS_BLUEPRINT_AI_API_KEY`, and optional `SOS_BLUEPRINT_AI_MODEL`). Never paste keys/passwords in chat or command arguments. Do not run the old `configure` command to add them.
- The promotional video is paused/draft and is not part of this release.
- This package updates the **EC2 web app and API**. It does not publish an Expo native binary or an app-store release.
- Database audit history may retain old approval labels/records. They are evidence, not an active approval workflow; no historical financial data is deleted.
- Statutory LP/RERA permits and explicit blueprint review are not financial approval processes and remain meaningful.

## Before deployment

1. Schedule a short maintenance window and ask users to pause financial entry.
2. Take a fresh AWS RDS snapshot as an additional precaution. RDS is shared; never delete or restore unrelated application databases.
3. Keep the downloaded archive, this guide and its SHA-256. Verify the archive BEFORE extraction/executing anything.
4. The updater also creates a private **`sos` schema dump + uploads archive** while the API is stopped. If that backup fails, it does not migrate.
5. Use the existing `sos_deploy` password at the hidden prompt. This is not the `sos_runtime` password, owner password or partner PIN.
6. Required EC2 tools: Python 3, Java 21+, Nginx, systemctl, curl, psql, pg_dump and pg_restore.
7. **pg_dump must be the same major version as RDS or newer.** Install a compatible PostgreSQL client first if the preflight reports a version mismatch. No service is stopped for that error.
8. Preserve `/etc/syndicateos/runtime.env`, the existing RDS CA and `/var/lib/syndicateos/uploads`.

## Release verification performed locally

- Web TypeScript check and production build at root path `/`: passed.
- All 57 web regression tests: passed.
- Backend production JAR build: passed; 36 tests passed and one opt-in live AI test was skipped.
- All 13 deployment-safety tests: passed, including cancellation, backup failure and post-migration activation failure.
- Actual V19 → V21 rehearsal against disposable loopback databases: passed.
- Rehearsal preserved identity/credential fingerprints, an existing firm/account, and a legacy pending investment without posting it.
- Actual local pg_dump/pg_restore recovery and privileges for the added tables: passed.
- V1–V19 migration files are unchanged from the original package; the new JAR contains the current V1–V21 SQL.
- These checks do not prove the customer's signed-in production flows or live AI provider are ready. Complete the acceptance checklist after installation.

## What the installer does

- Validates checksums, base installation, runtime database target, Java, Nginx and the migration port.
- Verifies exact lowercase database `sos`, existing owner, successful V19–V21 history and pg_dump compatibility BEFORE stopping the API.
- Requires explicit `UPDATE SOS` confirmation; uppercase/lowercase input is accepted.
- Stops only `syndicateos-api`, makes and validates backups, then installs a new checksummed directory at `/opt/syndicateos/releases/sos-consolidated-20261012`.
- Applies additive migrations through guarded upgrade-only Java setup. No initial owner setup, sample data or password reset.
- Grants the existing runtime role access to the added tables without granting migration-history writes.
- Preserves the effective JVM arguments, loopback binding, credentials, private uploads, runtime-disabled migrations and service sandbox.
- Activates the versioned JAR via a reversible systemd override, and changes only the SOS web root.
- Verifies the actual API command/binary, readiness, HTTPS release marker, and exact index content for `/` and `/owner`, with retries for Nginx worker transitions.
- Original `/opt/syndicateos/current` files and their checksums are not overwritten.

## Post-deployment checks

Run the permanent verifier:

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261012/update.py verify
sudo systemctl is-active syndicateos-api
sudo nginx -t
curl --fail --silent --show-error https://sos.krishisetu9.in/release.json
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
```

Expected release marker: `frontend_fix` = `sos-consolidated-20261012`,
`schema_version` = `"21"`. Expected readiness: `status` = `"ready"`,
`targetVerified` = `true`. The original base deployment.json still describes the
preserved base release, not the new schema.

Open a new private browser window:

- Owner: `https://sos.krishisetu9.in/owner`
- Accountant/partner: `https://sos.krishisetu9.in/`

### Signed-in acceptance — do not skip

- Existing owner/firm/users/projects and credentials still work; no sample firm or reset appeared.
- Check the assigned firm and existing account balances against the pre-update records.
- Firm/profile code edits persist after reload. Confirm any changed code remains the correct login code.
- Both role headers, En/Te and firm/project selectors work. Accountant order is Firm → Project → Edit → Add Project.
- Add Project starts blank; cancel/reopen starts fresh. Edit tracks the selected project, exposes the matrix and bank section, and saves/reloads correctly.
- Test project setup with a valid private plan, partners and Cash/bank accounts. A rejected upload can be corrected and retried without creating another draft/code collision.
- Do not change booked/sold inventory or opening balances just to test. Use a designated test project or documented real changes.
- Verify Add Partner placement, capital-weighted save and authorized PIN reset. Do not reset a real customer's PIN merely for testing.
- Partner dashboard values, plot counts and account balance agree with the project's authoritative statement.
- New valid expense/investment/drawing entries post once, update balances and notify; no approval vote is requested.
- Use a designated test entry to verify Refer Back's reversal/reason and author-only Correct & Resubmit. Confirm no duplicate money effect.
- Old pending entries remain unposted until explicitly resubmitted; do not bulk-resubmit uncertain historical money.
- Enrolled By filtering, header sorting, Clear Filters, CSV export and navigation work.
- Blueprint originals/downloads, manual review, widths/plot labels and illustrative 3D work for the selected project. An unconfigured/failed AI provider shows an explicit error, not fabricated geometry.
- The floating unavailable-actions widget and crossed/removed modules do not appear.
- Confirm the notification bell; background push is NOT an acceptance claim for this package.

## Failure and recovery

Keep the exact private backup path printed by the installer.
It contains `sos.dump`, `uploads.tar.gz`, `runtime.env`, prior routing/override and `state.json`.
It is root-only; do not upload or share its contents because it contains customer data and credentials.

- Before migration begins, a failure restores the prior routing/service configuration and restarts the previous API.
- Once migration has begun, a failure restores prior routing/service override but **leaves SOS stopped**. This avoids silently running an old financial API against newly changed data.
- The updater never drops tables, cleans Flyway, rewrites history or automatically restores a database.
- First collect the error and safe service logs; do not print runtime.env or passwords:

```bash
sudo journalctl -u syndicateos-api -n 100 --no-pager
sudo nginx -t
```

For a deliberate configuration rollback, use the verified updater and the exact
backup path printed earlier:

```bash
sudo python3 /opt/syndicateos/releases/sos-consolidated-20261012/update.py rollback /opt/syndicateos-update-backups/EXACT_PRINTED_DIRECTORY
```

This restores prior routing/systemd override only and leaves the API stopped.
It does NOT restore the DB or uploads. Review any post-update entries before
starting an older API or restoring data: restoring the dump would discard changes
made after the backup. Never restore the entire shared RDS instance to undo SOS.
If the package directory was not installed yet, use `update.py` from the verified
extracted archive instead.
