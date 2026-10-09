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

Accountant and partner dashboards must be ported from the user's Google AI Studio GitHub application, not replaced with a newly designed generic workspace or project form. The repository is the requirements source; the user should not have to explain every existing feature again.

**Why:** The user tried the deployed accountant dashboard and explicitly corrected that the extensive dashboard work already done in Google AI Studio was missing.

**How to apply:** Inspect and migrate the source dashboards and their complete dependencies, preserving recognizable layouts and workflows while adapting to React Native, Spring Boot and PostgreSQL. Maintain a parity inventory; do not equate finished onboarding with finished client dashboards.

The accountant workspace needs an Add Project button beside a dropdown of projects under its firm.
All operational information entered belongs to an individual project; firms link projects, not shared business data.
The Add Project form is the comprehensive initial setup, including sector details, plans, documents, partners/equity and project accounts.

**Why:** The user explicitly clarified this ownership rule and provided the original multi-section project setup screenshots.

**How to apply:** Treat partner participation, banking, inventory and finance as project-specific. Reusable login identities and tenant-security/configuration relations do not imply shared capital or balances. Never replace comprehensive setup with a minimal name/location form.

Project bank accounts may differ project by project; this is actual ownership, not merely renaming "Firm Accounts."
Data must automatically integrate between the relevant tabs and authorized dashboards within its respective project.

**Why:** The user corrected the label-only interpretation and explicitly required integration when supplying the partner, banking, booking and expense screenshots.

**How to apply:** Keep one authoritative project-scoped record and reuse its IDs in downstream workflows/views. Saving a bank account must populate that project's receipt/debit choices without re-entry; automatic synchronization never implies bypassing financial approval or permissions.
