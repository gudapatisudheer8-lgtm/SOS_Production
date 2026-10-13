---
name: ERP delivery decisions
description: Financial integrity and private files on the existing AWS deployment.
---
Keep cleared financial postings immutable, balanced and transactionally saved; corrections are new entries.
**Why:** the original prototype updated browser balances and trusted approval-name strings, which are unsafe as authoritative financial records.
**How to apply:** preserve authenticated actor identities, project/firm checks, request idempotency and explicit account selection when extending source workflows.

Use a private single-instance EC2 attachment adapter for the current AWS release.
**Why:** the existing deployment is user-operated EC2/RDS; Replit-only storage does not automatically follow it.
**How to apply:** back up file bytes and database metadata together; recommend private S3 before multi-instance or automatic instance replacement.

Keep disposable preview databases in ignored persistent local state and check actual listener readiness.
**Why:** workspace restarts remove temporary files/processes; a stale postmaster PID can outlive its database process.
**How to apply:** explicitly enable localhost-only development fixtures and never seed the customer's RDS.

Run password-change and onboarding acceptance tests against a separate disposable database, not the owner's Preview account.
**Why:** bootstrap secrets do not override an existing changed owner password; tests must not leave the user's account inaccessible or populate their application with test firms.
**How to apply:** use synthetic identities on the isolated target and restore the Preview API proxy afterward. Verify browser saves through the real proxy, not only independent frontend/backend builds.

Use fresh disposable integration fixtures for each independent acceptance/build run.
**Why:** onboarding scenarios rotate the synthetic owner's credential, and committed snapshot fixtures can survive a prior run; reusing them produces misleading login and duplicate-identity failures.
**How to apply:** reset only positively identified isolated test targets, never the customer's Preview database or owner credentials.

Check the testing runner's database target before using its database tools.
**Why:** the runner may expose a separate built-in database rather than this application's local PostgreSQL; an isolated application database is not automatically available through that connection.
**How to apply:** seed the disposable local database from the main workspace when necessary, check its name explicitly, and provide the tester with browser-only fixture access. Do not substitute the runner's default database.

Isolated browser checks must use the same frontend styling and API-route behavior as Preview.
**Why:** a stripped-down test frontend produced false layout failures and an incorrectly scoped test expectation interrupted validation before the actual financial forms were checked.
**How to apply:** isolate the database/backend without changing rendering; respect firm-code session boundaries and verify actual form controls rather than treating explanatory approval text as an editable workflow. Allow the isolated browser's exact origin on its test API: changing a proxy's target host makes localhost cross-origin from Spring's perspective. Do not loosen the main application's origin policy to fix test-only HTTP 403 responses.

Dashboard delivery requires verifying the firm's assigned release and rendered interface, not just API health.
**Why:** additive configuration updates deliberately preserve existing firm assignments for compatibility; a healthy deployment can still display the old dashboard. Incorrect release names in rollout instructions caused unnecessary user effort.
**How to apply:** use actual published release labels rather than planning terminology, keep activation owner-controlled, and distinguish successful installation from verified dashboard activation.

The user requests no approval processes throughout the application, replacing them with a notification bell plus browser and mobile push notifications. This supersedes the earlier independent-approval requirement.
**Why:** the user wants to simplify the application and explicitly said approvals must be removed everywhere.
**How to apply:** valid financial submissions post immediately. Notifications are informational, never a prerequisite for posting. Statutory permits and reviewed blueprint geometry are not financial sign-offs. Background push delivery must be verified separately from a polling bell or foreground browser notifications.

Use Refer Back → Correct & Resubmit for financial mistakes, on the Project Statement screen. Refer Back appends a balanced reversal; only the original author can correct and resubmit a new linked entry, not another user acting as accountant. Preserve originals and reasons.
**Why:** the user requested same-screen corrections instead of approvals and explicitly chose original-author-only correction access rather than allowing the accountant too; overwriting a cleared amount would lose audit history and silently corrupt balances.
**How to apply:** enforce project access, revisions, idempotency, sufficient funds and linked booking/reimbursement checks. Never edit or delete original posted journal legs.

Do not automatically post historical pending money when retiring approvals. Keep it unposted until the author explicitly corrects and resubmits.
**Why:** the old-pending-records clarification was dismissed; automatically moving unconfirmed money would change customer balances without an explicit instruction. This conservative handling was explained to the user.
**How to apply:** allow author-only correction of legacy unposted records; never migrate their amounts into account balances automatically.
