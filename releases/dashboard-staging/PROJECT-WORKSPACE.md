# Project-first workspace build

This package contains compiled React Native web assets and the Spring Boot API.
It adds migrations V6–V7. V1–V5 are unchanged.

## Implemented
- Searchable all-firm project selection beside Add Project, switching the assigned sector interface automatically.
- Database-defined project setup: identity and adaptive sector details, physical inventory groups, partner equity and committed capital, project accounts, private web documents, settings and review.
- Uploaded documents use the assigned release's document fields and category choices. Required category validation runs before finalization; the integration test uploads a PDF and links it during successful project creation.
- Incomplete child details can be saved as a resumable draft. Drafts cannot accept operating or financial records and are not exposed to partner users.
- Final creation is atomic. Failed validation rolls back children and memberships. Retried requests do not duplicate projects, accounts, openings or inventory.
- Project accounts, partner membership, inventory, bookings, expenses, reimbursements and statements use shared project-scoped records.
- Pending bookings reserve inventory without crediting the bank. Independent review clears the payment. Parallel duplicate bookings are rejected.
- Deleting a pending booking releases its reservation transactionally. Resubmitting a rejected booking reserves again only if no competing active booking exists. Historical pending reservations are reconciled by migration V7.
- Individual-funded expenses create a payable. Reimbursement settles that payable and debits the selected project account only after independent approval; it does not create a second expense.
- Business option lists and form/policy definitions are PostgreSQL configuration. Trusted calculation handlers, security limits and workflow state codes remain server code.
- The demo-data loader has been removed. Configuration migrations do not seed example businesses or operating transactions.

## Verification
- Java package: 12 tests passed, none skipped, including PostgreSQL-backed migration, tenancy, project setup, rollback, retries, opening balance, reservation and reimbursement checks.
- TypeScript check and web export passed.
- Running API and Expo workflows started; public branded company-code page was visually checked.
- Signed-in forms were not given a fresh browser end-to-end pass. Existing test fixtures are isolated from the running application.

## Deliberate limits
- Full Aadhaar/PAN/customer registration ID collection is disabled until protected storage and audited access are implemented. This build rejects unencrypted registration IDs.
- Native device file picking and safe SVG support are not delivered here. Web supports the permitted PDF/PNG/JPEG/WebP uploads.
- This is a functional project-first migration, not a claim of pixel-perfect parity with every Google AI Studio screen.

## Activate after installing
Follow DEPLOYMENT.md, including database/file backup and privileges for new tables.
In the owner portal, explicitly assign the new published **Project workspace · [sector name]** release to each intended firm sector. Existing assignments are preserved by migration.
Sign out, refresh and sign in again. Without this assignment, clients keep their previous configuration.
