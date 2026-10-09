# SyndicateOS — original-application replica

## Agreed baseline

The user confirmed that https://github.com/gudapatisudheer8-lgtm/SOS contains the same version as their linked Google AI Studio application.

The deliverable is the complete original application's interfaces and connected workflows. It is not a new design, a subset limited to open plotting, or another generic configuration-rendered dashboard. Earlier requested interface customizations are deferred until the replica is complete.

The repository's remote HEAD and the locally inspected original source matched when this plan was prepared. The AI Studio link displayed Google sign-in in the inspection browser; its interactive screens were not independently inspected there.

## Implementation approach

- Reuse the original React web components, CSS, assets and interaction structure. Do not translate the web interface into generic React Native field renderers.
- Preserve the original UI event contracts while implementing persistent, authorized backend operations. Retain the required Spring Boot/PostgreSQL backend; any incompatibility must be identified rather than silently replacing a workflow.
- Keep business configuration and choices in PostgreSQL, without allowing the configuration engine to substitute different layouts for the original components.
- Keep firms, projects and their operational records correctly scoped. Accountants and partners must see authorized views of the same persisted records.
- Preserve intended calculations and state transitions. Identify source inconsistencies explicitly instead of silently redesigning behavior.
- Do not import demo business records or use browser-only state as successful persistence. Source demo-restore/reset functions are not production initialization.
- Enforce authentication and authorization on the server, not only through the original frontend login gate.
- Preserve the current EC2 deployment, database and uploads during development. This plan does not authorize deletion.

## Source-backed interface inventory

These are implementation and acceptance items, not claims of completion.

### Entry and administration
- [ ] Header and role/firm/project context.
- [ ] ProductionAuthGate and AccountantLoginGate.
- [ ] SuperAdminView and its firm/member/configuration operations.
- [ ] AddFirmMemberModal.
- [ ] DirectPortalLinksModal.

### Accountant and project workspace
- [ ] AccountantDashboard, including its original layout and all tab transitions.
- [ ] AddProjectModal, including every original sector-specific section.
- [ ] FirmAccountsBar and AddFirmAccountModal.
- [ ] SyndicateEquityModule and IndividualInvestmentModal.
- [ ] AuditLogViewer.
- [ ] ProjectStatementModule and FirmAccountStatementModal.
- [ ] RecordLedgerTransactionModal and TallyExportModal.

### Sector interfaces and plans
- [ ] OpenPlottingModule and VentureLayoutMasterGrid.
- [ ] OpenPlottingPlanBuilder.
- [ ] ConstructionModule and ConstructionPlanBuilder.
- [ ] LiquorVendSettlementModule and LiquorVendPlanBuilder.
- [ ] CustomInfraPlanBuilder.
- [ ] PlanDocumentUploader.

### Transactions, review and sharing
- [ ] CustomerPlotBookingModal.
- [ ] EnrollExpenseModal.
- [ ] MultiPartnerApprovalModal.
- [ ] DiscountAlertModal.
- [ ] MarketingPlotPortalModal and its linked workflow.
- [ ] FieldPartnerMobileView, including its complete original tab and action set.

Every component's nested actions must be checked; this list is not permission to implement only the initial visible state.

## Connected-workflow acceptance

For each source workflow, record its input fields, validation, calculation, persisted records, resulting statuses and affected views before wiring it into the replacement.

- [ ] Firm creation and membership lead to the appropriate authorized interface.
- [ ] Project creation persists setup, sector details, plans, inventory, partners and bank accounts.
- [ ] Project switching isolates all displayed and editable operational data.
- [ ] Partner allocations and investments update the relevant project summaries and statements.
- [ ] Booking a plot/unit updates inventory, receipts, bank entries and outstanding amounts according to the original workflow.
- [ ] Expenses distinguish payment sources and update approval status, accounts and partner views consistently.
- [ ] Review, rejection and settlement follow authorized state transitions without duplicate postings.
- [ ] Sector-specific construction and liquor actions persist their results and update their related views.
- [ ] Documents, statements, exports and sharing perform real operations rather than placeholder button responses.
- [ ] Reloading and signing in again restores saved state from the database.
- [ ] Editing and failed submissions preserve valid data and report errors explicitly.
- [ ] Duplicate submissions, unauthorized users and cross-project requests are rejected safely.

## Verification and release gate

1. Run the original source as the visual reference where its dependencies permit; do not require the user to explain its screens again.
2. Compare each replacement screen and important modal state against that source and the supplied screenshots, on desktop and relevant mobile-web widths.
3. Exercise the connected workflows using disposable test data isolated from production. Do not seed the delivered application with those records.
4. Present actual signed-in replacement screenshots and a truthful remaining-differences list. A passing build or health endpoint does not establish interface fidelity.
5. Do not hand off another EC2 archive as the completed replica while required inventory items remain unfinished.
6. Once verified, prepare one versioned installation package, configuration/database setup, checksums, backup and rollback instructions.
7. Confirm installed frontend assets, backend/database readiness, active firm configuration and visible signed-in screens separately.

## Current status

Source identity and the initial component inventory are verified. This document does not mark the replica as implemented, tested or deployed.
