---
name: EC2 update handoffs
description: Avoid missing checksum sidecars and unintended SSH logout during manual updates.
---

Provide self-contained verification commands for the current archive, with its verified SHA-256 inline. Do not assume the checksum sidecar was uploaded. Put fail-fast commands inside a subshell rather than enabling errexit in the interactive SSH shell.

**Why:** The user has repeatedly uploaded only the archive and pasted earlier-package instructions. Missing sidecars then caused interactive SSH sessions to exit before installation.

**How to apply:** Verify the current release hash before giving commands. Use the exact uploaded filename, extract to a new temporary directory, and finish verification before stopping services. Require a fresh database backup before migration or activation.

Treat package installation, database migration, firm configuration activation, and reference-screen acceptance as separate delivery checks. A successful health response is not evidence that the requested interface is active or faithfully reproduced.

**Why:** The user repeatedly reported unchanged accountant forms after successful deployment logs. Independent review found both configuration-dependent rendering and genuine reference-layout gaps; attributing the complaint solely to deployment or caching would miss unfinished UI work.

**How to apply:** Before another release handoff, verify the signed-in accountant and partner flows against the supplied original source and screenshots. Fresh-install acceptance must include project creation with a plan attachment, partners, inventory, and Cash/bank accounts, not just login or attachment-free creation. Separate background ledger GET failures from setup/upload/finalize POST failures: the attachment workflow intentionally persists a draft before it has operational ledgers. Distinguish proven local behavior from unverified production activation. Do not send another archive merely to repeat a successful installation.

Account for Nginx's asynchronous worker transition when verifying HTTPS immediately after a reload. A successful reload command does not guarantee the first request uses the new configuration.

**Why:** A fresh activation's first release request hit an old-root redirect cycle, while a later request served the correct release with valid file permissions. Reload timing was the likely cause, not a database or permissions failure.

**How to apply:** Check the failing route and current response before changing configuration. Future activation checks should use bounded retries with exact release/readiness validation and retain fail-closed behavior for persistent errors.

For frontend-only EC2 hotfixes, retain the original checksummed release and switch the SOS web root to a separate versioned frontend directory.

**Why:** In-place replacement of frontend files invalidates the base installer's package checksums and can block later configuration or activation. A separate root also permits routing rollback without touching credentials, uploads, or the database.

**How to apply:** Back up only the SOS routing snippet, validate syntax and exact frontend markers over HTTPS with bounded retries, and restore the prior routing on failure.

Project-creation acceptance must include a rejected plan upload followed by retry, not only a valid small-file happy path.

**Why:** A valid-plan test passed while real rejected uploads left drafts behind; changing the local form identifier on every submit then collided with the database's unique project code. File-picker advertisements also exceeded the API's accepted formats.

**How to apply:** Validate plan type and size before persisting a draft, retain the same draft across retries, and obtain explicit confirmation before continuing an existing unfinished setup. Never remove code uniqueness or silently delete drafts to resolve a conflict.

API hotfixes must also preserve the original checksummed release: install the jar side by side and change its systemd command through a reversible override.

**Why:** Replacing the base jar in place would invalidate future deployment checks just as replacing the original frontend would.

**How to apply:** Preserve the base environment file, JVM limits, private uploads, disabled runtime migrations and loopback binding. Verify the active command and readiness; restore the prior override on failure.

Do not reuse a no-migration hotfix installer for a schema-bearing consolidated release. Back up database metadata and file bytes during the same stopped-API window.

**Why:** later blueprint and financial-correction work needs additive storage that the earlier API/frontend patches did not install. API health alone does not establish that those tables or runtime privileges exist.

**How to apply:** explicitly upgrade the existing database without bootstrap/reset, apply runtime-role grants, and verify migration history before activating the matched web/API pair. Treat preserved base metadata as historical; check the served release and effective API command. After a migration-stage failure, leave the API stopped for diagnosis rather than silently restarting an older financial API or automatically restoring customer data.
