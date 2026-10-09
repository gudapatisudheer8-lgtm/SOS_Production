---
name: Expo static asset routing
description: Public Expo web exports can contain hidden-looking pnpm directory segments.
---

Expo web exports from pnpm workspaces can preserve `.pnpm` directory segments in public asset URLs. Do not treat every hidden-looking URL segment as a private file: route intentionally published assets explicitly while retaining hidden-file protection elsewhere.

**Why:** A blanket Nginx dot-path denial can block legitimate bundled fonts even when HTML, JavaScript, HTTPS and API readiness all work. An HTML or readiness check alone does not verify asset delivery.

**How to apply:** Inspect actual exported asset URLs when configuring a web server. Reserve the public assets directory for trusted export output, never full dependency installations, credentials or private uploads. Verify a representative asset returns its actual file rather than a forbidden response or SPA HTML fallback.
