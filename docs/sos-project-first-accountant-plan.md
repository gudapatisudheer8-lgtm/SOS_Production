# SOS consolidated project workspace and integration plan

## Status and scope
This is a design and implementation plan, not an implemented feature or a database migration.
No AWS data or deployed application is changed by this document.

Reviewed all 23 supplied screenshots and the original repository:
https://github.com/gudapatisudheer8-lgtm/SOS
In particular: AddProjectModal, Project/ProjectPartnerShare types, accountant dashboard, plan-builder
dependencies, AddFirmAccountModal, CustomerPlotBookingModal and EnrollExpenseModal.
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
- Bank-account ownership is genuinely project-specific, not a cosmetic rename of a firm account.
  Different projects may use different banks/accounts. A source label or component name containing
  "Firm Account" does not permit its bank balance to be shared across projects.
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
- Bank-account cards, choices and balances come only from the selected project's registered accounts.
  Labels explain that ownership; changing a label alone does not satisfy this requirement.
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

## 4. Detailed internal forms

All forms show project name/code in the header, preserve entries on validation errors, prevent
double submission, and use database-configured options appropriate to the project's sector/release.
In an existing project, the header's selection determines the project; it is not freely changed inside
an unfinished booking/expense/account form. In Add Project setup, child forms attach to that draft.

### A. Add partner / project equity allocation
- Select an existing authorized partner or add name/mobile for a new login identity.
- Project role, fixed equity percentage and capital estimated/committed investment value.
- Show share total out of 100%, per-partner commitment and total project commitments.
- Split Equity Equally, Sync Capital from Cost, and Sync Cost from Capital are explicit actions
  with a preview/confirmation before overwriting entered values.
- Maintain project-specific participation even when the same identity joins another project.
- Adding a partner updates the partner strip, equity table and authorized partner project list.
- Removing a draft row is allowed; removing participation with posted history means controlled
  access deactivation, not deletion of contributions or transactions.
- Commitment/share updates do not post deposits or recalculate historical distributions silently.

### B. Add project bank/cash account
- Designated project: selected project or new-project draft; never a tenant-wide unallocated account.
- Account type and bank/depository institution.
- Account display name, account number and confirmation, IFSC, branch/city.
- Opening ledger balance and effective date, optional UPI ID, primary-account flag, signatories and notes.
- Confirmed number is a validation input, not a duplicate stored account-number field.
- Bank-specific fields are conditional; petty cash is a real project ledger account without fake bank details.
- Mask account numbers in cards/statements; expose full details only to authorized roles.
- On save, use the same account ID in Accounts & Treasury, booking receipts, partner contributions,
  expense payments and account-specific statements.
- Opening balance is recorded once as an audited balanced opening transaction; never repeatedly
  applied when account metadata is edited.
- RERA/escrow names and restrictions are configured policy. A screenshot's "70% protected" label
  must not be presented as proof that statutory compliance or bank enforcement has been implemented.
- MVP uses separate project ledgers. Reusing one physical bank account across projects, if requested
  later, needs an explicit shared-bank reconciliation model; do not infer or silently pool it.

### C. Plot tap → customer booking
- Tap a plot card to open the correct project's booking form.
- Read-only plot context: number, facing, area (square yards/square feet), dimensions, road approach.
- Buyer name/mobile; optional Aadhaar/PAN where justified for the registration workflow.
- Rate per square yard, protected floor rate, calculated total price.
- Token/advance amount; configurable quick amounts and full-payment shortcut.
- Payment mode, cheque/UTR/reference and receiving account chosen only from this project.
- Calculated outstanding balance, booking status, agreement/payment stage, terms/notes.
- Confirm Booking & Generate Token Slip, plus authorized later payments, release/cancellation and
  refund/correction flows from the source.
- Persist customer and booking linked to project/inventory; later payments append receipts rather
  than replacing advanceReceived and posting the whole amount again.
- Lock/check plot revision and availability during confirmation so two sessions cannot book it twice.
- Below-floor prices follow a configured approval workflow, not an editable bypass.
- Receipt verification is separate from reservation: a plot may be reserved while payment is pending,
  but uncleared receipts do not increase bank balance.
- Token acknowledgement may show pending verification; a cleared-money receipt is issued only after
  the required confirmation. Slips use saved IDs/values and support authorized print/download.
- Customer identifiers are optional/minimized, protected at rest, masked in UI and excluded from
  public marketing pages, ordinary exports, logs and unnecessary partner views.

### D. Enroll project expense
- Project Bank Account versus Individual/Partner Funds payment source.
- For project-bank spending: this project's debit account and current cleared balance.
- For individual spending: actual payer/partner associated with this project.
- Expense date, spender, configured cost category and amount.
- Vendor/contractor, bill/voucher/invoice number, payment mode/reference.
- Approval workflow choice allowed by policy; narration/work details and optional bill/photo/voice evidence.
- The actual submitting identity comes from the session. Recording a different spender is an explicit
  on-behalf-of field, not impersonating that person as the submitting or approving user.
- Pending submission updates pending-review counters, not cleared account balance.
- Approved project-bank expense produces exactly one expense and one linked settlement, with balanced
  postings; it updates account passbook, statement, category totals and dashboard spend.
- Approved personally paid expense records the expense and a project obligation to the payer.
  It does not debit a project bank account that did not pay it.
- Later reimbursement settles that obligation once; it is not a second expense.
- Treating personal payment as capital instead of reimbursement is an explicit authorized classification,
  never an automatic increase in equity or invested capital.
- "Fast Approve" cannot bypass independent approval by changing a dropdown. Only authorized independent
  reviewers can use the permitted expedited path; record their real identities.

## 5. Automatic integration across tabs and dashboards

One saved record/workflow is the authoritative source. Views refer to it by project and entity IDs;
do not copy editable totals or ask users to repeat the same transaction in another tab.

| Action | Automatic effects within that project |
|---|---|
| Finalize project | Dropdown, context card, sector module, saved plan/documents, initial partners/accounts/inventory |
| Add partner / edit commitment | Partner strip, equity table, commitment totals; authorized partner project list |
| Register account | Treasury card, booking/investment receipt choices, expense debit choices, account passbook |
| Enter verified opening balance | Account/treasury balance and opening entry in statement; no duplicate income |
| Reserve/book plot | Plot status and availability counters, buyer/booking details, acknowledgement and due schedule |
| Clear customer payment | Linked booking outstanding amount, chosen account/passbook, inflow statement and dashboards |
| Clear partner contribution | Project account balance, actual-invested totals, partner ledger and statement |
| Submit expense | Expense list and authorized pending-approval counters |
| Approve and settle bank expense | Spend/category totals, debit-account passbook, treasury, statement and dashboard |
| Approve personally paid expense | Project spend, payer obligation and authorized partner view; bank balance unchanged |
| Reimburse payer | Payer obligation and bank/passbook/statement; expense total unchanged |
| Correct/refund approved money | New linked reversal/refund entries and recomputed balances; original history retained |
| Add/update blueprint or plan | Authorized document views, layout/blueprint tabs and validated plan summaries |

Automatic integration does not mean automatic approval or visibility of private accountant data to everyone.
Partner screens consume the same authorized project data, not separate independently maintained balances.
Source calculations must distinguish commitments, approved investment, customer receipts, revenue recognition,
expenses, reimbursements, drawings and projected profit; bookings are not automatically earned revenue.

Frontend/API synchronization:
- After successful save, refresh/invalidate all affected project-specific queries, not just the active tab.
- Return committed entity IDs/status/revisions so UI success reflects persistence, not a local browser mutation.
- Fetch current data on tab activation, session restore and focus.
- For other open sessions/dashboards, use revision-based background refresh while online; expose sync/error state.
  Continuous push updates can be added later if immediate cross-device refresh is required.
- Cache keys include tenant, project and authorized role/identity. Cancel obsolete requests on project switch.
- Offline drafts never masquerade as successful bookings, approved payments or settled expenses.

## 6. Dashboard and tab parity

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

## 7. PostgreSQL plan — additive, not a replacement

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
- account, inventory, booking, customer and partner references are checked within the same project.
  Forms cannot rely on display names or a client-supplied firm/project identifier for authorization.
- preserve receipt-to-booking, settlement-to-expense and reimbursement-to-payer-obligation links with
  uniqueness constraints and revision checks. These are what prevent duplicated financial effects.
- store approval/clearing state separately from booking and agreement stage.
- partner identity/access membership is distinct from the project equity/commitment profile;
  neither is a substitute for actual cleared contribution records.
- sensitive customer and banking fields require selective read permissions and protected storage;
  confirm the retention/encryption approach before collecting full registration identifiers.
- money remains exact PostgreSQL numeric/Java decimal; no browser-authoritative totals.
- preserve existing project IDs, users, balances and records. Legacy project codes require a reviewed
  transition; do not silently fabricate codes or mark old projects unusable.

Do not introduce parallel project_accounts/plots/expense tables duplicating working ERP storage
without a demonstrated relational need and migration plan.

## 8. Spring Boot/API workflow

Contract-first operations:
- List firm-authorized projects; fetch assigned setup definition.
- Create setup draft after minimum identity/sector information is valid.
- Read/save draft sections using revision checks.
- Upload documents against the real draft project ID.
- Validate and preview the complete bundle and inventory.
- Finalize once with an idempotency key; return project, records/counts and new-login access.
- Fetch/update project details and run all tab operations with an explicit authorized project ID.
- Add/update participation; register account and one-time opening entry.
- Reserve/book inventory, submit/verify additional receipts, produce saved booking/token documents.
- Submit/review/settle expenses, record personal-pay obligations and reimbursements.
- Return shared project summaries/passbooks/partner ledgers from committed records, not client-maintained totals.

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

## 9. Delivery order and acceptance

1. Complete source-action/field inventory and UI/schema contracts.
2. Build the project selector and complete Add Project flow, including draft/edit/review.
3. Implement setup persistence, one-time finalization and safe additive migration.
4. Build and integrate partner, bank-account, booking and expense forms across accountant/partner views.
5. Finish all tab actions, plotting presentation/marketing workflows and source visual details.
6. Verify with disposable data, then prepare the EC2 package and activation instructions.

Acceptance:
- Two projects in the same firm retain entirely separate partners/equity, accounts, inventory,
  finance, attachments, approvals and statements.
- Project A never appears in Project B's records, totals, account choices or generated inventory.
- Reload/another session sees saved values. Switching cannot display stale data.
- Complete creation, draft recovery, cancel, edit and retry behavior are exercised.
- Invalid code/equity/area/account/file input cannot leave an activated partial project.
- Budget/commitment changes cannot manufacture cash.
- Save an account once and verify it appears in that project's booking/expense forms without re-entry.
- Book a plot from its card; verify reservation, outstanding amount, payment status and saved token slip.
- Confirm a payment twice/retry a request; verify the account was credited only once.
- Submit/approve a bank-paid expense; verify pending versus cleared totals and one account debit.
- Submit a personal-paid expense then reimburse it; verify one expense and one reimbursement, not two expenses.
- Edit an account label; verify its opening balance is not applied again.
- Verify actor versus actual spender, independent approval and above/below-floor booking paths.
- Verify permitted partner totals refresh from the same project records without exposing customer identifiers.
- Verify other open sessions refresh, and project switching cannot apply a late response to the wrong project.
- Partner access is project-specific; another firm and own-review attempts are denied.
- Original source dialogs/actions are checked individually, including their result after reload.
- Verification of assigned release and visible UI precedes any claim of completed dashboard parity.

Recommendation: complete the project setup/data foundation before adding more disconnected forms.
Use the source as the interaction baseline, but do not copy fabricated defaults or unsafe finance.
