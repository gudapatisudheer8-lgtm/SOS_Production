---
name: Web and native session delivery
description: Why SOS uses bearer sessions across browser previews and eventual native clients.
---

Use database-backed opaque bearer sessions. Browser tokens are per-tab in sessionStorage; native tokens use SecureStore, with explicit storage failures and no insecure fallback.

**Why:** Expo browser previews and the API can have different origins, and the same application must later support native clients. Cookie-only authentication would require a different delivery and CSRF model.

**How to apply:** Keep tokens out of logs and ordinary native storage. Clear identity-scoped query caches when sessions end. If switching production web to HttpOnly cookies, explicitly revisit CSRF, cookie attributes, cross-origin behavior and native authentication rather than silently retaining bearer-only assumptions.
