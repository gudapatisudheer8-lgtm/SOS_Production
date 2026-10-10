---
name: Simple open plotting forms
description: User-facing simplicity and the Google AI Studio references for accountant and partner workflows.
---

Preserve the original-replica baseline while applying the user's subsequent explicit customization requests.

The user wants a simple, user-friendly open-plotting application for both accountant and partner dashboards, not unnecessary fields. Use their Google AI Studio reference flow: compact facing-wise plot count/area entry, automatic partner allocation from project cost, and bank entry with bank name, account holder name, account number, IFSC and branch.

**Why:** The user repeatedly rejected long generic forms despite supplying screenshots. Faithfulness to the intended workflow matters more than exposing every available configuration field.

**How to apply:** Keep basic entry concise, distinguish planned capital from money received, enforce project-cost allocation limits, and preserve existing internal data when simplifying a form. Apply the same usable field presentation to setup and the project's live tabs.

Each project must have its own default Cash account and ledger. Bank accounts belong to the project, never a firm-wide account pool. Remove project selection and account-type selection inside Add Project's bank-account form.

The user expects the automatic Cash account to be visible in Add Project's banking section, not only after the project has been created.

**Why:** The user explicitly requested this so cash transactions contribute to the complete ledger of the respective project.

**How to apply:** Show the planned Cash account clearly as created on save, without fabricating a saved account ID. Provision it automatically without invented bank details or opening money. Route project cash receipts/payments to that project's cash account; distinguish partner-personal spending from project cash and preserve existing approvals and posting history.

The user requires plots, roads, utilities and other allocated spaces together to stay within the declared venture area, with synchronized automatic calculations and visible free/unallocated area.

**Why:** Clients need to understand how much land is allocated and avoid allocating more land than the venture actually contains.

**How to apply:** Treat declared venture area as the shared area limit across project entry and dashboards. Distinguish measured road area from estimates; road width alone does not establish its occupied area.
