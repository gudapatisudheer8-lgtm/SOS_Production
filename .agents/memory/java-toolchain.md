---
name: Consistent Java compiler selection
description: Replit Java module and Nix JDK selection can disagree between Java and Maven.
---

Ensure Maven's `JAVA_HOME` matches the selected Java executable; checking `java -version` alone is insufficient.

**Why:** The Replit Java/GraalVM module supplied an older `JAVA_HOME` while the separately installed Nix JDK was first on `PATH`. Java reported the selected version, but Maven still used the older compiler and rejected the requested release.

**How to apply:** Use the project's Maven wrapper script for builds and development, and inspect both Java and Maven runtime versions when changing toolchains. Do not downgrade the application's target merely to accommodate a mismatched compiler.
