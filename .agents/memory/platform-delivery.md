---
name: Role platforms and delivery order
description: Confirmed browser and mobile delivery requirements for SOS roles.
---

Owner is web-only, with a separate entry link and no owner option on client login. Accountant needs web and mobile access. Partner is intended as a mobile application, but initially must work as mobile web. Complete browser development before preparing the native accountant and partner dashboards.

Client entry must show SyndicateOS branding and company code first, then username/mobile and PIN. Do not ask the user to choose accountant or partner: resolve their authorized dashboard from credentials and firm membership.

Accountant and partner login should accept the ten-digit Indian mobile number and add +91 automatically. After company-code entry, show the actual firm name rather than the code. Their private PIN must be exactly six numeric digits, displayed with six masked/dash positions.

**Why:** The user explicitly requested these client-entry and numeric PIN rules after trying the deployed application. Longer credentials are for owner access, not the normal client PIN interface.

**How to apply:** Preserve company-scoped role resolution and leading zeroes in PINs. Existing long client credentials need a verified transition into PIN setup rather than an arbitrary password replacement or a bulk lockout.

**Why:** The user revised the owner requirement to web-only and explicitly requested a separate owner link and company-code-first, role-free client entry.

**How to apply:** Keep owner management out of client entry and native access. Make accountant web responsive and partner web mobile-first. Preserve distinct sector-specific interfaces for both roles. Native releases remain a later milestone requiring device testing, not an automatic consequence of finishing a browser implementation.
