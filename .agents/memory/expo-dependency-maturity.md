---
name: Expo dependency maturity
description: Handling SDK-compatible packages blocked by the workspace's minimum release age.
---

An Expo SDK installer can recommend a newly published patch that the package firewall refuses because it is newer than the workspace release-age cutoff. This is not evidence that the SDK or package is broken.

**Why:** Installing native sharing failed on the recommended patch while the preceding patch in the same SDK line installed successfully. The Expo CLI may still report the recommended newer patch afterward.

**How to apply:** Inspect the install failure and select an eligible patch in the same SDK-compatible version line. Do not replace the framework, upgrade unrelated packages, or weaken the package firewall merely to match the latest patch recommendation.
