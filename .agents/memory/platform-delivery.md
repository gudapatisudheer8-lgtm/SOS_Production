---
name: Role platforms and delivery order
description: Confirmed browser and mobile delivery requirements for SOS roles.
---

## Keep both platforms

Keep both web and mobile versions available. Showing or updating the mobile version must not replace the web application.

**Why:** The user explicitly asked to keep both web and mobile while trying the mobile preview.

**How to apply:** Preserve both application artifacts and distinguish the native mobile preview from the responsive web application and its EC2 deployment.

## Current delivery priority: original replica first

The user now requests the complete Google AI Studio application's interfaces and connected workflows as they are, before any further changes. Earlier requests for simplification or customized screens are deferred until that replica is complete, not prerequisites for the baseline.

The user confirmed that their supplied GitHub SOS repository contains the same version as the linked Google AI Studio application. Use it as the authoritative replica source rather than requesting the screen requirements again.

Develop and show the application in the right-side Preview first. The user will review it there and explicitly confirm when to prepare EC2 deployment instructions.

**Why:** The user explicitly requested the same preview-first delivery approach as their Krishisetu application.

**How to apply:** Do not prepare or suggest an EC2 deployment handoff before that confirmation; keep the existing EC2 installation untouched during preview development.

**Why:** The user explicitly said they will give changes after receiving the replica, having repeatedly rejected partial or redesigned substitutes.

**How to apply:** Use the original application source as the baseline and establish that it matches the current AI Studio version. Do not limit the deliverable to an initial accountant flow or silently apply earlier UI modifications. Do not delete the existing EC2 installation or database merely to resolve UI differences.

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

Accountant and partner account actions belong in the clickable user profile menu, rather than repeated Sign out buttons in dashboard headers.

**Why:** The user requested a more professional, less crowded header with PIN change and logout under the user profile.

**How to apply:** Retain active firm/project selectors and identity information; use the existing six-digit client PIN policy and authenticated credential-change flow.

Owners may change an existing firm's sign-in code without creating a new firm or resetting its projects and ledgers. The new code replaces the old code for future sign-ins.

**Why:** The user expected an owner edit to change the existing firm's code to SHA, and reported a silent save that left the old code unchanged.

**How to apply:** Explain the sign-in impact, retain stable firm/project IDs and assignments, reject duplicate codes, and do not introduce old-code aliases without an explicit decision.
