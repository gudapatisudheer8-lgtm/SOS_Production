---
name: ERP delivery decisions
description: Financial integrity and private files on the existing AWS deployment.
---
Keep cleared financial postings immutable, balanced and transactionally saved; corrections are new entries.
**Why:** the original prototype updated browser balances and trusted approval-name strings, which are unsafe as authoritative financial records.
**How to apply:** preserve independent approval identities, project/firm checks, request idempotency and explicit account selection when extending source workflows.

Use a private single-instance EC2 attachment adapter for the current AWS release.
**Why:** the existing deployment is user-operated EC2/RDS; Replit-only storage does not automatically follow it.
**How to apply:** back up file bytes and database metadata together; recommend private S3 before multi-instance or automatic instance replacement.

Keep disposable preview databases in ignored persistent local state and check actual listener readiness.
**Why:** workspace restarts remove temporary files/processes; a stale postmaster PID can outlive its database process.
**How to apply:** explicitly enable localhost-only development fixtures and never seed the customer's RDS.

Run password-change and onboarding acceptance tests against a separate disposable database, not the owner's Preview account.
**Why:** bootstrap secrets do not override an existing changed owner password; tests must not leave the user's account inaccessible or populate their application with test firms.
**How to apply:** use synthetic identities on the isolated target and restore the Preview API proxy afterward. Verify browser saves through the real proxy, not only independent frontend/backend builds.

Check the testing runner's database target before using its database tools.
**Why:** the runner may expose a separate built-in database rather than this application's local PostgreSQL; an isolated application database is not automatically available through that connection.
**How to apply:** seed the disposable local database from the main workspace when necessary, check its name explicitly, and provide the tester with browser-only fixture access. Do not substitute the runner's default database.

Dashboard delivery requires verifying the firm's assigned release and rendered interface, not just API health.
**Why:** additive configuration updates deliberately preserve existing firm assignments for compatibility; a healthy deployment can still display the old dashboard. Incorrect release names in rollout instructions caused unnecessary user effort.
**How to apply:** use actual published release labels rather than planning terminology, keep activation owner-controlled, and distinguish successful installation from verified dashboard activation.
