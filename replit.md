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

### Required product stack

- React Native mobile frontend (Expo).
- Java Spring Boot backend.
- PostgreSQL database.
- The first version built in Google AI Studio is at https://github.com/gudapatisudheer8-lgtm/SOS. Its source has been reviewed: reuse its business workflows and domain models as reference, while retaining the required React Native, Java Spring Boot, and PostgreSQL product stack.
- The mobile build remains a clearly labelled local demo. It is not yet connected to live onboarding APIs.
- The API scaffold has been replaced with a Java 21 / Spring Boot service providing liveness, read-only database readiness checks, and default-deny security. Login, owner bootstrap, onboarding APIs, and tenant-authorised business operations remain to be implemented.
- The relational onboarding/configuration migration is drafted but has not been applied or tested against PostgreSQL. No SOS tables or application accounts have been created.

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
- See `docs/sector-configuration-design.md` for the configuration design and `artifacts/api-server/src/main/resources/db/migration/` for the draft relational migration. Neither indicates a migration has been applied.

## Confirmed onboarding and access flow

- The admin dashboard belongs to the product owner, who onboards clients/firms and assigns their required sectors.
- Firm onboarding automatically provisions accountant access. Accountants use the client code provided by the admin to identify their firm.
- Each sector has distinct accountant and partner interfaces, selected from assigned sectors and the user's firm/project permissions.
- Accountants add projects and partners. Adding a partner automatically provisions that partner's login.
- Partners log in with their mobile number and a default PIN, with a mandatory PIN/password change on first login.
- The user created AWS EC2 and a PostgreSQL database named SOS on the shared KrishiSetu RDS instance. The user reports that SOS is empty after checking through pgAdmin, and has confirmed EC2-to-RDS TCP connectivity and restored SSH access. The workspace cannot yet reach RDS; Spring Boot SQL authentication and database privileges remain unverified. Verify the exact target before writes, scope SOS setup to its own database, and do not alter other applications' databases or AWS network settings without explicit approval.
- PostgreSQL remains on RDS; no PostgreSQL server installation is needed on EC2. A command-line PostgreSQL client is optional because pgAdmin can run SQL checks.
- The intended AWS web hostname is sos.krishisetu9.in. Its A record resolves to the SOS EC2 address; this does not establish that the app is deployed or HTTPS is configured.
- Admin/accountant need desktop web and mobile. Partner starts with mobile web; native dashboards follow browser development, with real device testing before release.

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
