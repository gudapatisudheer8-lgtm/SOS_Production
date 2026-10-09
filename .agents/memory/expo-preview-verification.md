---
name: Expo preview settling
description: Avoid mistaking an early mobile font-loading capture for a broken login screen.
---

A quick Expo app-preview capture can stop on the font-loading screen on mobile even when the same route renders correctly after settling. An already bundled desktop capture may settle sooner.

**Why:** Mobile captures showed only the startup spinner while a settled browser capture confirmed the complete branded company-code screen without a runtime failure.

**How to apply:** When an image shows startup loading, confirm the settled route before diagnosing the login or changing authentication. Prefer a browser capture that waits for asset loading over repeated quick screenshots.
