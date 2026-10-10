---
name: EC2 update handoffs
description: Avoid missing checksum sidecars and unintended SSH logout during manual updates.
---

Provide self-contained verification commands for the current archive, with its verified SHA-256 inline. Do not assume the checksum sidecar was uploaded. Put fail-fast commands inside a subshell rather than enabling errexit in the interactive SSH shell.

**Why:** The user has repeatedly uploaded only the archive and pasted earlier-package instructions. Missing sidecars then caused interactive SSH sessions to exit before installation.

**How to apply:** Verify the current release hash before giving commands. Use the exact uploaded filename, extract to a new temporary directory, and finish verification before stopping services. Require a fresh database backup before migration or activation.

Treat package installation, database migration, firm configuration activation, and reference-screen acceptance as separate delivery checks. A successful health response is not evidence that the requested interface is active or faithfully reproduced.

**Why:** The user repeatedly reported unchanged accountant forms after successful deployment logs. Independent review found both configuration-dependent rendering and genuine reference-layout gaps; attributing the complaint solely to deployment or caching would miss unfinished UI work.

**How to apply:** Before another release handoff, verify the signed-in accountant and partner flows against the supplied original source and screenshots. Distinguish proven local behavior from unverified production activation. Do not send another archive merely to repeat a successful installation.

Account for Nginx's asynchronous worker transition when verifying HTTPS immediately after a reload. A successful reload command does not guarantee the first request uses the new configuration.

**Why:** A fresh activation's first release request hit an old-root redirect cycle, while a later request served the correct release with valid file permissions. Reload timing was the likely cause, not a database or permissions failure.

**How to apply:** Check the failing route and current response before changing configuration. Future activation checks should use bounded retries with exact release/readiness validation and retain fail-closed behavior for persistent errors.

For frontend-only EC2 hotfixes, retain the original checksummed release and switch the SOS web root to a separate versioned frontend directory.

**Why:** In-place replacement of frontend files invalidates the base installer's package checksums and can block later configuration or activation. A separate root also permits routing rollback without touching credentials, uploads, or the database.

**How to apply:** Back up only the SOS routing snippet, validate syntax and exact frontend markers over HTTPS with bounded retries, and restore the prior routing on failure.
