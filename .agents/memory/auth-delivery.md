---
name: Web and native session delivery
description: Why SOS uses bearer sessions across browser previews and eventual native clients.
---

Use database-backed opaque bearer sessions. Browser tokens are per-tab in sessionStorage; native tokens use SecureStore, with explicit storage failures and no insecure fallback.

**Why:** Expo browser previews and the API can have different origins, and the same application must later support native clients. Cookie-only authentication would require a different delivery and CSRF model.

**How to apply:** Keep tokens out of logs and ordinary native storage. Clear identity-scoped query caches when sessions end. If switching production web to HttpOnly cookies, explicitly revisit CSRF, cookie attributes, cross-origin behavior and native authentication rather than silently retaining bearer-only assumptions.

Account provisioning and recovery must communicate the server-issued temporary PIN, never advertise a universal prototype PIN.

**Why:** leftover prototype login instructions made a newly provisioned accountant unable to sign in despite successful firm creation.

**How to apply:** display issuance results transiently in the owner flow, explain that reused identities keep their existing PIN, and offer an explicitly confirmed owner reset if the notice was missed. Warn that resetting a shared identity affects its sessions across firms; never persist plaintext PINs.

An isolated test gateway verifies application behavior, not actual Replit Preview access/routing.

**Why:** an isolated project/plan save passed, but the user subsequently encountered a Replit access-page redirect and CORS failure in the real Preview.

**How to apply:** verify same-origin API routing through the actual Preview/shared router as well. Protected-endpoint probes with invalid credentials can confirm API JSON responses without changing customer data. Distinguish platform access redirects from application session failures.

Finish workflow restarts before browser verification. A component harness mounted only in browser memory disappears when Vite reloads the page.

**Why:** A restart interrupted a responsive layout check and removed the temporary harness; that blank harness was not evidence of a persistent application failure.

**How to apply:** Avoid edits and restarts during captures. Isolated component rendering can check presentation without customer writes, but does not verify authenticated saving or the complete dashboard.

Preserve the browser's Host header when an isolated UI-test proxy forwards requests to Spring.

**Why:** Rewriting Host to the upstream API port made same-origin browser POSTs appear cross-origin. Spring rejected both company verification and invitation creation, while GET requests still worked.

**How to apply:** Distinguish a plain-text `Invalid CORS request` from application authorization errors before changing authentication or weakening allowed origins.

Authenticated browser checks through the real development Preview must distinguish login completion from dashboard hydration.

**Why:** A valid client sign-in remained on “Authenticating…” beyond a short default assertion window; direct API login succeeded, and waiting for its response followed by configuration/workspace hydration verified the dashboard.

**How to apply:** Await the actual login response and then the signed-in dashboard readiness separately. Do not diagnose slow Preview requests as invalid credentials or bypass real authentication with mocked sessions.
