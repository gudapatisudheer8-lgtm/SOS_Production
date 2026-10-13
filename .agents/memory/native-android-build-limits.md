---
name: Native Android build limits
description: Why Android APK compilation should use a remote builder in this workspace.
---

Prefer a remote Android builder with per-project signing rather than installing the full SDK, NDK and Gradle locally in this workspace.

**Why:** Local extraction exhausted the writable filesystem quota even while `df` reported substantial host disk space. An earlier JVM performance-counter SIGBUS crash left the native compiler partially installed; the explicit quota error only appeared during recovery. Host free-space figures therefore did not establish that a native build could fit.

**How to apply:** Do not repeat large native toolchain downloads merely because `df` shows free space. If local compilation reports quota errors, remove only its temporary build staging, restore affected preview services, and use a linked EAS project or another properly provisioned remote builder. Distinguish a compiled JavaScript bundle from an actual APK; never claim that a build has started remotely until a real build ID is returned.
