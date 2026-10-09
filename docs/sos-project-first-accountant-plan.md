# SOS project-first accountant workspace — proposed plan

## Status and scope
This is a design and implementation plan, not an implemented feature or a database migration.
No AWS data or deployed application is changed by this document.

Reviewed all 18 supplied screenshots and the original repository:
https://github.com/gudapatisudheer8-lgtm/SOS
In particular: AddProjectModal, Project/ProjectPartnerShare types, accountant dashboard, and their plan-builder dependencies.
The screenshots are the visual baseline; the repository supplies the remaining dialogs and workflows.
Prototype numbers, account details, partners, PINs, plot dimensions and amenities are not production seed data.

## 1. Ownership rule

Firm → Projects → all operational records.

- Firm holds tenant identity, accountant access and owner-assigned sector/interface configuration.
- Each project owns its venture details, budget, physical plan, documents, partner participation, accounts,
  inventory, bookings, investments, expenses, approvals, transactions, statements and audit history.
- Login identities may be reused. A partner's role, equity, commitment, investments, drawings and approvals
  remain specific to each project.
- Firm identifiers on child records are tenant-security checks, not a second ownership model.
- No firm-level pooled balance or automatic mixing of different projects.
- Configuration/reference tables are shared definitions, not business transactions.

## 2. Accountant workspace

Top area:

    Firm name / code                         Accountant / Sign out
    Project: [Searchable project dropdown ▼] [+ Add Project]
    Dashboard | Partners & Equity | Sector module | Project Accounts |
    Expenses & Approvals | Project Statement

- Show project name + project code in the dropdown; list only projects under the signed-in firm.
- Every tab uses the same selected project. Never substitute another project silently.
- Retain the selected project on refresh when access remains valid.
- Switching projects reloads records, counts, permissions, accounts, inventory and KPI totals together.
- Warn before switching away from unsaved work; avoid showing stale previous-project results.
- No projects: show a useful empty state with Add Project, not an always-visible generic project form.
- After successful creation, select the new project and show its saved details.
- Rename Firm Accounts to Project Accounts throughout the accountant dashboard.
- No firm picker exposing other tenants. Only offer another firm when independently authorized.

Visual baseline: white/off-white cards, dark navy text/active tabs, amber primary actions,
compact badges, clear Indian-number formatting and the existing official SOS logo.
On mobile, stack the selector/action and use a full-screen setup flow with accessible sections.

## 3. Complete Add Project setup

Desktop: large modal with section navigation, internal scrolling, persistent summary/footer.
Mobile: full-screen equivalent, with the same fields and saved data.

Sections: Identity → Sector Details → Physical Plan → Documents → Partners & Equity →
Project Accounts → Review.
Provide All Sections and jump-to-section navigation matching the original form.
Save Draft, Cancel and Create Project & Load Data are distinct actions.
Keep data when moving between sections; show errors beside fields and in the review summary.

### A. Project identity
- Venture/project name; project code/tag, unique within the firm.
- Sector engine, restricted to the firm's enabled assigned sectors.
- Development stage: planning, approvals, active sales, development, completed, as configured.
- Start date, target completion date and notes.
- Keep development stage distinct from operational active/completed/archived status.
- Changing the sector during setup requires confirmation before discarding incompatible fields.
- Do not freely change sector after inventory or financial activity exists.

### B. Sector-adaptable details

Open plotting:
- Location/corridor, mandal/district, survey numbers.
- Approval authority, LP/RERA reference.
- Land extent and unit, approach-road width, open-space percentage.
- Floor rate explicitly in ₹/square yard; total estimated project outlay.
- Authority/road options and configured deduction assumptions come from database configuration.
- Do not treat a prototype's road/open-space percentages as verified universal legal requirements.

Construction:
- Site, survey/approval/RERA details, estimated outlay.
- Floor plan, unit numbers/types/facing/areas, ₹/square-foot base rate and premiums.
- Amenities and common-area assumptions explicitly entered or chosen from approved configuration.

Liquor:
- Vend/location, licence and excise-authority details.
- Counters, facilities, daily sales targets, security deposit and estimated outlay.

Custom infrastructure:
- Site/stretch, tender/contract number, principal/authority, LOA/work-order reference.
- Contract model, work packages/facilities, retention/BG and estimated outlay.

Each sector's field visibility, validation, units, choices and supported section layout are versioned
database configuration. Reuse trusted UI widgets and backend calculations; do not execute arbitrary
JavaScript or SQL stored in configuration.

### C. Physical plan and inventory
- Plot matrix: East, North, West, South, Corner and Commercial groups, with count and area per plot.
- Group totals, parcel deductions, net area and projected value displayed with labelled units.
- Configure plot numbering, blocks, road/frontage, dimensions and facing-price rules rather than
  inventing these from the source's hardcoded examples.
- Construction floor/unit builder and sector-specific counter/work-package builders.
- Explicit auto-generate inventory checkbox; preview generated counts, numbers and prices.
- Warn about inconsistent parcel/matrix areas; require explanation or correction under configured rules.
- Preserve entered data when generation is off; do not pretend planned plots already exist in inventory.
- Generation is idempotent. Later regeneration must never overwrite booked/sold inventory.

### D. Documents
- Upload multiple sanctioned plans, blueprints, permits and related documents.
- Preview, rename/type, remove draft attachment, upload status and actionable errors.
- Support validated PNG/JPG/WEBP/PDF; SVG needs sanitization/safe preview before enabling it.
- Private file storage and project-scoped metadata/access; no base64 files in financial JSON.
- No sample master plan in production.

### E. Partners and equity
- Add existing authorized identity or a new partner directly inside setup.
- Name/mobile, project role, agreed share and committed capital for this project.
- Fixed-share and capital-weighted modes, equal split and explicit cost/commitment synchronization.
- Show allocation total and validate shares; allow a project with no partners initially.
- Draft allocations may be incomplete; publishing a fixed allocation requires 100%.
- Committed capital is not actual invested money. Actual investment requires a separate financial entry.
- Provision new login access only on successful finalization; reuse existing identity without resetting it.
- Never show existing plaintext PINs. Keep secure six-digit temporary-access/reset behavior.

### F. Project accounts and banking
- Add dedicated escrow, capital-pool, current, petty-cash or other configured account types.
- Bank details, authorized signatories and optional primary receipt account.
- Cash-account fields differ from bank fields; do not invent an IFSC or bank account number.
- Optional accounts can be completed later; transactions requiring an account remain blocked until configured.
- Never select an account belonging to another project.
- Genuine opening balances follow the existing audited opening-entry rules, not an editable fake balance.

### G. Review and completion
- Summarize identity, sector, budget, area/counts, documents, partners/shares and accounts.
- Flag required omissions and conflicts before submission.
- Finalization saves the complete bundle and returns project ID, saved counts and provisioned access.
- Show the saved project immediately; do not report success while subordinate records failed.

## 4. Dashboard and tab parity

Dashboard:
- Selected venture identity, code, stage, survey/approval summary and sector metrics.
- Partner participation strip, commitment vs actual investment and explicit investment action.
- Estimated project cost, projected inventory sales, partner count and approved-money KPIs.
- Project bank/cash summary and activity. Projections are labelled as estimates, not balances.

Partners & Equity:
- Project participation table, agreed share, commitment, actual contributions, drawings, net position.
- Fixed/capital-weighted calculation, add/edit participation, secure reset access and financial actions.

Open Plotting:
- Source-like facing groups, road separators, plot cards, status/search filters and totals.
- Interactive grid, sanctioned blueprint and split view; presentation mode with private finance hidden.
- Floor-rate protection, customer booking and inventory lifecycle.
- Marketing share links, rate proposals and pending-request review are explicitly included in the parity
  inventory; authenticated and public access need separate secure contracts, not fake buttons.

Project Accounts:
- Account-category filters, bank/cash/total summary, primary-account marker, account cards,
  record transaction, inflow/outflow actions and account-specific passbooks.

Expenses & Approvals:
- Project budget/spend/pending/remaining metrics, cost categories, vendor/voucher search,
  submission, evidence, independent approvals, reconciliation and status filters.

Project Statement:
- Approved inflows/outflows/net treasury, per-account strip, date/type/partner filters, search,
  CSV and print. Pending/rejected records do not become cleared-money totals.

Nested dialogs and actions must be reviewed from source for every tab. A matching top bar is not
proof of parity. Maintain a checklist of each action, its fields, API, persistence and role checks.

## 5. PostgreSQL plan — additive, not a replacement

Reuse existing SOS tables:

| Existing structure | Responsibility |
|---|---|
| firms / firm_sector_assignments | Tenant identity and available sector releases |
| projects | Firm-linked project identity, lifecycle, versioned sector details |
| identities / project_memberships | Login identity and project-specific authorized access |
| erp_records | Existing project-owned accounts, partner profiles, plots/units, finance and bookings |
| erp_project_settings | Plan configuration, equity mode and project workflow settings |
| erp_attachments | Private project document metadata |
| erp_approvals / erp_postings / erp_audit | Review, authoritative money postings and project audit |
| sector configuration tables | Versioned sections, fields, units, options, resource policies |

Proposed additions/extensions, to be finalized against the API contract:
- projects: nullable/backfilled project code, setup state DRAFT/READY, setup release reference,
  development stage and target completion metadata. Unique normalized project code per firm.
- project_setup_sections: project ID, section key, validated draft payload and revision, for
  resumable structured setup. Use typed fields for identifiers and JSONB for sector-varying content.
- project_setup_requests: project ID, operation/request ID, payload fingerprint and finalization result,
  preventing duplicate creation/inventory on retries.
- attachment metadata: document category and draft/finalized association.
- extend versioned form configuration for complete setup sections, rather than another global
  hardcoded project form.
- all business child relations require project identity and cross-project reference checks.
  Keep existing firm IDs needed for authorization/composite foreign keys.
- money remains exact PostgreSQL numeric/Java decimal; no browser-authoritative totals.
- preserve existing project IDs, users, balances and records. Legacy project codes require a reviewed
  transition; do not silently fabricate codes or mark old projects unusable.

Do not introduce parallel project_accounts/plots/expense tables duplicating working ERP storage
without a demonstrated relational need and migration plan.

## 6. Spring Boot/API workflow

Contract-first operations:
- List firm-authorized projects; fetch assigned setup definition.
- Create setup draft after minimum identity/sector information is valid.
- Read/save draft sections using revision checks.
- Upload documents against the real draft project ID.
- Validate and preview the complete bundle and inventory.
- Finalize once with an idempotency key; return project, records/counts and new-login access.
- Fetch/update project details and run all tab operations with an explicit authorized project ID.

Drafts are project-owned and visible as drafts, not operational ventures. Uploading cannot bypass
the existing attachment API's required project relation.

Finalization uses one DB transaction for project state, plan, memberships/profiles, accounts,
inventory and audit. Validate first; rollback all DB changes on failure.
File bytes are not part of a PostgreSQL transaction: upload before finalization, verify ownership/
upload completion, promote metadata transactionally, and safely clean abandoned draft files later.
Don't issue usable partner credentials or activate membership before finalization succeeds.
Opening-money entries retain their existing audit/approval rules.
Large plans need defined limits; reject unsupported sizes clearly rather than silently creating
partial inventory in independent batches.

Owner sector-release changes must validate against existing project data. Preserve the project setup
schema/calculation version and report incompatible changes; do not reinterpret saved values silently.

## 7. Delivery order and acceptance

1. Complete source-action/field inventory and UI/schema contracts.
2. Build the project selector and complete Add Project flow, including draft/edit/review.
3. Implement setup persistence, one-time finalization and safe additive migration.
4. Connect the dashboard and all tabs consistently to the selected project.
5. Finish nested dialogs, plotting presentation/marketing workflows and source visual details.
6. Verify with disposable data, then prepare the EC2 package and activation instructions.

Acceptance:
- Two projects in the same firm retain entirely separate partners/equity, accounts, inventory,
  finance, attachments, approvals and statements.
- Project A never appears in Project B's records, totals, account choices or generated inventory.
- Reload/another session sees saved values. Switching cannot display stale data.
- Complete creation, draft recovery, cancel, edit and retry behavior are exercised.
- Invalid code/equity/area/account/file input cannot leave an activated partial project.
- Budget/commitment changes cannot manufacture cash.
- Partner access is project-specific; another firm and own-review attempts are denied.
- Original source dialogs/actions are checked individually, including their result after reload.
- Verification of assigned release and visible UI precedes any claim of completed dashboard parity.

Recommendation: complete the project setup/data foundation before adding more disconnected forms.
Use the source as the interaction baseline, but do not copy fabricated defaults or unsafe finance.
