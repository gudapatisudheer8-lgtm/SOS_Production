# SOS database-driven sector configuration design

Status: proposed implementation design. No schema in this document has been applied, and the current React Native demo still uses sample configuration.

## Requirement

Every sector has its own accountant interface and its own partner interface. PostgreSQL controls sector assignment, screens, navigation, fields, validation, workflows, and business options. A sector is not a hardcoded frontend enum or a Java switch statement.

The product owner onboards firms and assigns sectors. Accountant access is provisioned during onboarding. Accountants create projects and partners; new partner access is provisioned automatically. Partners use their mobile number and a temporary/default PIN, with mandatory first-login credential change.

## Identity and assignment tables

All identifiers below are UUIDs unless noted. Use foreign keys, timestamps, and unique constraints; do not trust firm IDs supplied by the frontend.

| Table | Main columns | Purpose and constraints |
| --- | --- | --- |
| `firms` | `id`, `client_code`, `name`, `status` | Unique client code identifies a firm; it is not an authentication credential. |
| `users` | `id`, `mobile_e164`, `credential_hash`, `must_change_credential`, `status` | Unique normalized mobile identifies a user. Store only credential hashes. |
| `roles` | `id`, `code`, `name` | Role definitions, including product owner, accountant, and partner. |
| `firm_memberships` | `id`, `firm_id`, `user_id`, `role_id`, `status` | Unique firm/user/role membership. Existing partners can be reused without resetting their credentials. |
| `projects` | `id`, `firm_id`, `sector_id`, `name`, `status` | Sector ownership is stable. Removing firm sector access does not reclassify or delete a project. |
| `project_memberships` | `firm_id`, `project_id`, `membership_id`, `access_scope` | Links authorised firm members to projects. Enforce that both ends belong to the same firm. |
| `sectors` | `id`, `code`, `name`, `description`, `status` | Database rows define sectors; no compiled sector list. |
| `firm_sector_assignments` | `id`, `firm_id`, `sector_id`, `release_id`, `status` | Unique firm/sector assignment. Pins a firm to a published configuration release for that sector. |

Provisioning must be transactional and idempotent. Create a firm, its sector assignments, and accountant membership together. Create/reuse a partner identity and its memberships together. First-login access is limited to credential change until completed.

## Configuration tables

Configuration IDs are not user-accessible authorisation. The backend resolves access from authenticated memberships.

| Table | Main columns | Purpose and constraints |
| --- | --- | --- |
| `sector_releases` | `id`, `sector_id`, `version`, `status`, `published_at`, `published_by` | Draft, published, or retired releases. Unique sector/version. Published releases are immutable. |
| `sector_interfaces` | `id`, `release_id`, `role_id`, `interface_key`, `title` | Separate interfaces for accountant and partner within each release. Unique release/role/interface key. |
| `interface_screens` | `id`, `interface_id`, `screen_key`, `title`, `order_index`, `layout_config` | Navigation and screen layout. Unique interface/screen key. |
| `screen_components` | `id`, `screen_id`, `parent_id`, `component_key`, `component_type`, `order_index`, `props_config`, `data_source_id`, `visibility_rule_id` | Reusable cards, lists, forms, grids, and other registered component types. Parent must belong to the same screen. |
| `entity_definitions` | `id`, `release_id`, `entity_key`, `label`, `storage_kind` | Defines configurable sector entities, such as inventory units or measurement entries. |
| `field_definitions` | `id`, `entity_id`, `field_key`, `label`, `data_type`, `required`, `default_config`, `validation_config` | Typed field definitions and validation. Preserve absent values, nulls, and explicit zero distinctly. |
| `form_fields` | `id`, `component_id`, `field_id`, `order_index`, `display_config`, `visibility_rule_id` | Places reusable entity fields in role-specific forms. |
| `option_sets` / `option_values` | set key; value key, label, order, status | Database-controlled select options rather than frontend arrays. |
| `data_sources` | `id`, `release_id`, `source_key`, `handler_key`, `parameter_schema`, `result_schema` | References approved data handlers. No arbitrary SQL or user-configured external endpoints. |
| `actions` | `id`, `release_id`, `action_key`, `handler_key`, `input_schema`, `permission_key`, `workflow_id` | Configures approved operations and their permissions, not executable Java/JavaScript stored in the database. |
| `component_actions` | `component_id`, `action_id`, `event_key`, `display_config` | Binds buttons and interactions to approved actions. |
| `workflow_definitions` / `workflow_states` / `workflow_transitions` | release, entity, states, source/target, action, role, rule | Configurable business state machines and approval stages. Validate transitions on the server. |
| `rules` | `id`, `release_id`, `rule_key`, `expression_ast`, `result_type` | Restricted, typed declarative conditions; no `eval`, scripts, or arbitrary SQL. |
| `permission_grants` | `release_id`, `role_id`, `resource_key`, `action_key`, `scope`, `rule_id` | Default-deny permissions. Scopes are constrained to authorised firms/projects or the user's own records. |
| `firm_config_overrides` | `assignment_id`, `target_key`, `patch_config`, `version`, `status` | Validated client-specific presentation and business-option overrides. Cannot widen security scope or change sector identity. |
| `config_audit_events` | `id`, `actor_id`, `release_id`, `assignment_id`, `event_type`, `before_config`, `after_config`, `created_at` | Audits configuration changes and publication. Never includes credentials. |

Use JSONB for bounded layouts, component properties, validation schemas, and condition trees. Keep ownership, assignments, roles, links, publication state, and version identifiers relational. Validate JSONB structures against explicit schemas at publication and execution.

## Business data storage

- Keep financial postings, money amounts, project accounts, partner contributions, and project memberships in dedicated typed relational tables.
- Monetary columns use PostgreSQL `NUMERIC` and Java `BigDecimal`, not floating-point types.
- Project accounts require firm and project ownership. Journal postings have balanced lines and transaction-safe writes; posted records are corrected through controlled reversals, not arbitrary edits.
- Flexible nonfinancial sector entities can use `sector_records(id, firm_id, project_id, sector_id, entity_definition_id, schema_version, payload JSONB, record_version, created_by, created_at, updated_at)`.
- Validate each payload against its entity/field definitions. Enforce matching project, firm, sector, and schema ownership. Add indexes and dedicated typed tables when reporting or constraints require them.
- Configuration cannot bypass accounting integrity, tenant ownership, or credential security.

## Runtime code design

### Spring Boot

1. Authenticate the user and enforce mandatory first-login credential change.
2. Resolve firm and project memberships from the authenticated identity.
3. Resolve the firm's enabled sector assignments and published release.
4. Select the interface for the user's active role. A partner's sector list is also limited by authorised projects.
5. Merge validated client overrides and return a versioned interface manifest.
6. For data/action requests, independently recheck permissions, ownership, payload validation, workflow state, and concurrency.
7. Execute the registered handler and write the business operation and its audit event atomically.

Suggested API shapes:

- `GET /api/me/workspaces`: authorised firms, roles, sectors, and project scopes.
- `GET /api/workspaces/{firmId}/sectors/{sectorId}/interface`: authorised role-specific interface manifest.
- `POST /api/workspaces/{firmId}/sectors/{sectorId}/data/{sourceKey}`: approved, scoped data reads.
- `POST /api/workspaces/{firmId}/sectors/{sectorId}/actions/{actionKey}`: approved, validated operations.
- Admin APIs for onboarding, draft configuration, validation, publication, and assignment.

Action IDs and handler keys are not permissions. Unknown or unsupported component types, handlers, rules, or manifest versions must fail explicitly. Use idempotency keys for financial actions and provisioning; optimistic concurrency for mutable records/configuration drafts.

### React Native

Use a generic interface renderer with:

- A manifest loader keyed by firm, role, sector, and configuration version.
- A component registry for supported reusable UI building blocks.
- A typed form renderer using database-defined fields, options, and validations.
- A data-source client and action dispatcher.
- A role/sector switcher populated from authorised workspace responses.
- Explicit unsupported-configuration, denied-access, and load-error states.

Do not write `if (sector === "plotting")` to choose a dashboard, or maintain sector menu arrays in app code. Separate database manifests define plotting/accountant, plotting/partner, construction/accountant, construction/partner, and other combinations.

Frontend visibility checks improve usability but are never security enforcement.

## Configuration lifecycle

Create draft -> validate references and rules -> preview both role interfaces -> explicitly publish -> assign release to firms.

Publishing a new release must not automatically alter all clients. Activate assignments deliberately, retain previous versions for rollback, and migrate business records explicitly when field schemas change.

Cache published manifests by firm, role, sector, release, and override version. Clear client workspace state on logout or workspace change. Configuration access must not grant access to another client's business data.

## Flexibility boundary

Adding sectors, role-specific screens, fields, menus, options, and workflows using existing components and handlers should require database configuration only.

A genuinely new device capability, UI primitive, integration, or accounting operation still needs tested code. Database-driven configuration is not arbitrary executable code stored in tables. This keeps configuration flexible without letting it compromise tenant isolation or financial correctness.

## First implementation acceptance checks

- Two firms with different sector assignments receive different authorised manifests.
- Accountant and partner manifests differ within the same sector.
- A multi-sector firm can switch interfaces without cross-project data leakage.
- Adding a configured sector using existing capabilities needs no frontend sector branch.
- Disabling sector access preserves historical projects and data.
- New accountant/partner provisioning does not duplicate existing identities.
- First-login users cannot bypass credential change through API calls.
- Unauthorised data/action calls fail even when made outside the UI.
- Zero, null, and absent field values remain distinct.
- Invalid drafts cannot be published; unsupported configuration fails visibly.
- Failed provisioning/posting does not leave partial records.
