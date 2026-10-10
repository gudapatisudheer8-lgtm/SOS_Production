---
name: Database-driven business configuration
description: No mock operational data; business choices, sector names, forms and policies belong in versioned database configuration.
---

The user requires no mock application data and no hardcoded business configuration: dropdown values, sector names and related configuration must be stored in database tables.

**Why:** The user explicitly requested this when approving the consolidated project-first build.

**How to apply:** Read business options, form definitions and calculation policy from versioned PostgreSQL configuration. Configuration migrations may add reviewed master definitions, but must not seed example firms, projects, partners, bank accounts or transactions. Disposable automated-test fixtures must remain separate from the running application and deployment.

Published configuration changes require explicit firm assignment; do not silently replace a firm's active interface.

**Why:** Previous deployments looked unchanged because the rendered interface followed the firm's assigned release. Automatically switching assignments would instead risk changing live client behavior without review.

**How to apply:** Include the exact new release label and assignment step in deployment instructions. Preserve historical configuration and existing operational data.

Backward-compatible optional project metadata can be added through catalog-defined optional fields without changing a firm's release assignment or editing published definitions.

**Why:** Layout utility areas needed persistence on existing interfaces, whose published configuration is deliberately immutable.

**How to apply:** Extensions must not override existing bindings or introduce required fields or change financial/security rules. Use the same effective configuration for displaying, validating and saving them; keep their limits in PostgreSQL configuration.

Treat a migration as immutable once its EC2 archive has been shared, even if installation has not been confirmed.

**Why:** The user may already have downloaded or installed that archive. Changing its migration checksum would make later upgrades unsafe.

**How to apply:** Repair released behavior with a new additive migration and a clearly named replacement package. Never rewrite a previously shared migration.
