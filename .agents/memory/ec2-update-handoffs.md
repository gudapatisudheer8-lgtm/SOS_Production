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
