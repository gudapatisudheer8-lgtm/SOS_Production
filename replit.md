# SyndicateOS (SOS)

SyndicateOS is a multi-tenant business syndicate and ERP platform for multi-partner ventures across Andhra Pradesh and Telangana.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Spring Boot API using the artifact-managed `PORT`
- `pnpm --filter @workspace/api-server run build` — build the Java 21 executable JAR and run unit tests
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Do not use the scaffold's Drizzle `push` commands for SOS; its schema belongs to Spring Boot/Flyway.
- SOS database settings: `SOS_DB_HOST`, `SOS_DB_NAME`, `SOS_DB_PORT`; credentials are `SOS_DB_USERNAME` and `SOS_DB_PASSWORD` in Secrets.
- Database migrations are explicitly disabled and the connection pool is read-only pending target verification and write approval.

## Stack

### Branding

- The user supplied the official SOS/SyndicateOS logo ZIP. Use this artwork rather than the former generic layers icon; the navy wordmark needs a pale surface, including in dark mode.
- The frontend now uses navy styling and ivory/pale-blue login backgrounds. Logo/icon sources are in the mobile artifact's `assets/brand/`.
- The user confirmed the portal release is installed on EC2 and returned `READY`. The subsequent branding-only package is `releases/sos-branding-web.tar.gz`; it requires only a web-directory update, with no API, database or Nginx changes. See `docs/sos-ec2-release.md`.
- The user confirmed the branding is deployed. The next application-only release, `releases/sos-pin-login-update.tar.gz`, adds public active-firm-name resolution, ten-digit Indian client login and six-digit numeric client PIN setup. It requires both JAR and web replacement, but no SQL or bootstrap. Owner passwords stay longer; owner identities cannot be reused as client PIN identities because credentials are identity-wide. No new PIN policy has been applied to AWS by the agent.

### Required product stack

- React web frontend and React Native mobile frontend (Expo); the owner portal is web-only.
- Java Spring Boot backend.
- PostgreSQL database.
- The first version built in Google AI Studio is at https://github.com/gudapatisudheer8-lgtm/SOS. Its source has been reviewed: reuse its business workflows and domain models as reference, while retaining the required React Native, Java Spring Boot, and PostgreSQL product stack.
- The Expo frontend implements a company-code-first client entry followed by mobile/PIN login with server-resolved accountant/partner membership, and a separate web-only `/owner` portal. It includes first-login reset, owner firm/sector onboarding, configuration editing/preview/publication, accountant projects and partner provisioning, and read-only partner interfaces. Demo persistence and financial balances have been removed. It uses generated API clients and reports unavailable setup explicitly.
- The Java 21 / Spring Boot API implements hashed credentials, persisted opaque sessions, attempt limits, required credential changes, owner bootstrap, tenant-scoped onboarding commands and normalized configuration resolution. Default workspace settings keep database writes and automatic migrations disabled.
- Historical installation: on 2026-10-09 the user verified guarded setup, owner bootstrap, runtime grants, HTTPS readiness, certificate renewal and font routing on AWS database `SOS`. This installation is superseded by the fresh-database request below; do not assume its users or migration history still exist.
- The updated owner → firm → accountant reset → project → partner reset journey and independent portal-session restoration passed a browser test against disposable localhost PostgreSQL. API isolation tests also verified shared identities across firms, company-code denial, suspension, credential rotation and role precedence. This verifies the implementation, not an update of the AWS installation.
- Current fresh EC2 handoff: see `docs/sos-fresh-ec2-installation.md`. Complete protected browser acceptance on AWS before claiming the new installation is live; native binary distribution is separate from the web release.

### Initial workspace tooling

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Spring Boot, Spring Security, Spring JDBC and Flyway
- Business DB: AWS RDS PostgreSQL; the workspace's Drizzle library is unused scaffold tooling, not the SOS schema
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- API build: Maven executable JAR; pnpm invokes the Maven wrapper scripts

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Sector interfaces are created as reusable backend-managed workflow packages and assigned to clients, rather than shipping a separate application per sector.
- Client-specific sector workflows share the governance, accounting, permissions, and audit core.
- Accounts must be mapped to their designated project, not generic firm pools.
- The user explicitly requires a different accountant interface AND a different partner interface for every sector.
- All sector/business/interface configuration must live in PostgreSQL tables, not hardcoded sector enums, menus, forms, workflow branches, or dashboard components. The code supplies reusable components and trusted handlers; adding a sector using existing capabilities should require database configuration only.
- Configuration must be versioned, validated, and explicitly published. Database-defined permissions must be enforced by Spring Boot, not just used to hide UI elements. Tenant isolation and balanced financial posting remain mandatory safety invariants.
- See `docs/sector-configuration-design.md` for the configuration design and `artifacts/api-server/src/main/resources/db/migration/` for the versioned relational migrations. Initial AWS application was confirmed by the user; future changes require review and the appropriate migration approval.

## Confirmed onboarding and access flow

- The admin dashboard belongs to the product owner, who onboards clients/firms and assigns their required sectors.
- Firm onboarding automatically provisions accountant access. Accountants use the client code provided by the admin to identify their firm.
- Each sector has distinct accountant and partner interfaces, selected from assigned sectors and the user's firm/project permissions.
- Accountants add projects and partners. Adding a partner automatically provisions that partner's login.
- Partners log in with their mobile number and a default PIN, with a mandatory PIN/password change on first login.
- On 2026-10-10, after accepting Preview, the user said the database was deleted/recreated and approved preparing a fresh EC2 installation. The confirmed new database is lowercase `sos` on `krishisetu-db.cpmomccww28x.ap-south-1.rds.amazonaws.com`, EC2 `3.111.185.116`, domain `sos.krishisetu9.in`. AWS initialization/deployment has not been performed or verified by the agent. Never use the old uppercase `SOS` target or older update packages for this handoff.
- Scope fresh setup to `sos` only; do not alter sibling databases, shared AWS network settings, unrelated EC2 applications, HTTPS certificates, or private uploads. Archive the old SOS installation rather than broadly deleting server files.
- PostgreSQL remains on RDS; no PostgreSQL server installation is needed on EC2. The current guarded installer uses a PostgreSQL client and new dedicated migration/runtime roles. Owner credentials are entered privately during bootstrap; do not carry over the Preview database or test records.

## Product

The intended sectors are real-estate open plotting, residential construction, liquor vends and retail clusters, and turnkey infrastructure.

The shared core includes partner equity and capital ledgers, project treasury and double-entry accounting, role-specific access, vouchers, receipts, and auditable statements.

Preserve the first version's form behavior: no hardcoded plot-count limits; zero and empty/null input values must not be replaced by unwanted defaults.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
