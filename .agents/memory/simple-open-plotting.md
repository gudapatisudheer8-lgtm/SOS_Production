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

**How to apply:** Show the planned Cash account clearly as created on save, without fabricating a saved account ID. Provision it automatically without invented bank details or opening money. Route project cash receipts/payments to that project's cash account; distinguish partner-personal spending from project cash and preserve posting history. Follow the newer approval-removal target in ERP delivery decisions.

The user requires plots, roads, utilities and other allocated spaces together to stay within the declared venture area, with synchronized automatic calculations and visible free/unallocated area.

**Why:** Clients need to understand how much land is allocated and avoid allocating more land than the venture actually contains.

**How to apply:** Treat declared venture area as the shared area limit across project entry and dashboards. Distinguish measured road area from estimates; road width alone does not establish its occupied area.

The Open Plotting overview must be read-only and reflect the selected project's saved setup values, not an independent editable calculator or unrelated defaults.

**Why:** The user found different values in this overview than those entered in the project form and explicitly requested cards or a correct non-editable view.

**How to apply:** Show saved measurements and clearly labelled recorded inventory totals. Do not invent target selling rates, statutory deductions, net land or revenue estimates when those inputs are not recorded.

Approach-road widths and plot frontage road widths are independent measurements. Do not assign either to schematic internal-road segments without a saved segment mapping; missing measurements must remain unspecified.

**Why:** A saved approach width does not establish the width of every internal road, and facing-based visual sectors do not identify actual road segments.

**How to apply:** Use the selected project's saved approach measurement and each plot's own saved width. Keep schematic road segments unspecified until their measurements are explicitly recorded.

For the project-form simplification request, do not remove any project fields. Add Project must open an empty new-project form; editing the selected existing project is a separate action.

**Why:** The user corrected an interpretation of their screenshot: the highlight identified existing project details appearing in Add Project, not fields they wanted deleted.

**How to apply:** Keep create and edit modes distinct, retain all setup fields, and scope the selected project to the selected authorized firm. The user also requested removing the top dashboard files section; keep document access inside Add/Edit Project without deleting uploaded files.

Edit Project must use the same UI as Add Project, including the facing-wise plot matrix and bank-account section—not a separate individual saved-plot editor.

**Why:** The user explicitly rejected the individual saved-plot editor and repeated that editing should match the original entry form. Re-running the original creation template would risk the identities referenced by bookings and receipts.

**How to apply:** Seed the matrix from actual live inventory, retain mixed sizes unless explicitly changed, and reconcile available inventory while preserving existing identities and booked/sold records. Confirm count reductions; archive only unused available plots without history. Allow bank creation and metadata edits in the same form, but never edit an existing opening balance or default Cash ledger. Project, plot and bank changes must save atomically or all roll back.

Keep the partner dashboard focused on project plot inventory and bank-plus-cash balance. Investment entry, expense entry and drawing requests belong in Project Statements, not separate partner navigation tabs or repeated dashboard shortcuts.

**Why:** The user explicitly requested this simpler partner layout and the same project-wide counts and account balance used by the accountant, rather than the crossed personal investment/drawings/profit cards.

**How to apply:** Preserve underlying records and permissions when removing navigation. Keep partner drawing requests distinct from accountant drawing entry, and make the statement buttons open forms directly.

Keep firm/project selection and project actions in the single shared sticky header for accountant and partner dashboards, rather than separate context banners.
**Why:** the user asked to combine the accountant's top bars and move partner controls upward to free page space.
**How to apply:** retain selectors, project actions, notifications and the profile menu with responsive wrapping; do not reintroduce duplicate context bars or hardcoded offsets for stacked headers.

Firm selectors must remain openable even when only one authorized firm is available.
**Why:** the user reported the disabled single-firm dropdown as broken compared with the project dropdown.
**How to apply:** preserve the authorized firm list and selection callbacks; do not disable a selector solely because it has one option or broaden access to make more options appear.
