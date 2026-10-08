# SyndicateOS (SOS)

SyndicateOS is a multi-tenant business syndicate and ERP platform for multi-partner ventures across Andhra Pradesh and Telangana.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

### Required product stack

- React Native mobile frontend (Expo).
- Java Spring Boot backend.
- PostgreSQL database.
- The first version built in Google AI Studio is at https://github.com/gudapatisudheer8-lgtm/SOS. Its source has been reviewed: reuse its business workflows and domain models as reference, while retaining the required React Native, Java Spring Boot, and PostgreSQL product stack.
- The current mobile build is a clearly labelled local demo. No Java API, PostgreSQL business data, authentication, financial posting, or server-side tenant isolation has been implemented.
- The Express and Drizzle packages below are the initial workspace scaffold, not approval to substitute for the user's Java Spring Boot stack.

### Initial workspace tooling

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Sector interfaces are created as reusable backend-managed workflow packages and assigned to clients, rather than shipping a separate application per sector.
- Client-specific sector workflows share the governance, accounting, permissions, and audit core.
- Accounts must be mapped to their designated project, not generic firm pools.

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
