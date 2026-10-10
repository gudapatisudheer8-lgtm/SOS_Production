---
name: Simple open plotting forms
description: User-facing simplicity and the Google AI Studio references for accountant and partner workflows.
---

Preserve the original-replica baseline while applying the user's subsequent explicit customization requests.

The user wants a simple, user-friendly open-plotting application for both accountant and partner dashboards, not unnecessary fields. Use their Google AI Studio reference flow: compact facing-wise plot count/area entry, automatic partner allocation from project cost, and bank entry with bank name, account holder name, account number, IFSC and branch.

**Why:** The user repeatedly rejected long generic forms despite supplying screenshots. Faithfulness to the intended workflow matters more than exposing every available configuration field.

**How to apply:** Keep basic entry concise, distinguish planned capital from money received, enforce project-cost allocation limits, and preserve existing internal data when simplifying a form. Apply the same usable field presentation to setup and the project's live tabs.

Each project must have its own default Cash account and ledger. Bank accounts belong to the project, never a firm-wide account pool. Remove project selection and account-type selection inside Add Project's bank-account form.

**Why:** The user explicitly requested this so cash transactions contribute to the complete ledger of the respective project.

**How to apply:** Provision cash accounts automatically without invented bank details or opening money. Route project cash receipts/payments to that project's cash account; distinguish partner-personal spending from project cash and preserve existing approvals and posting history.
