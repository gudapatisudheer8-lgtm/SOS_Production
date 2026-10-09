# SOS AWS connectivity and deployment prerequisites

## Current safeguards

- Connection settings target the user-provided SOS database on the shared RDS instance.
- The agent has not performed database writes, migrations, owner provisioning or changes to AWS settings.
- The user has confirmed restored SSH access, successful EC2-to-RDS TCP connectivity, and an empty SOS database checked through pgAdmin. These confirmations do not independently verify Spring Boot SQL credentials or privileges.
- The workspace TCP connection to PostgreSQL timed out before authentication. This is not evidence that the password is wrong.
- Spring Boot starts independently of database availability. `/api/healthz` is liveness only; `/api/readyz` returns 503 while connectivity or foundation setup is pending.
- JDBC requires TLS certificate and hostname verification using the public AWS RDS CA bundle. Do not weaken `sslmode` or use a trust-all certificate manager.
- The connection pool is read-only, Flyway is disabled, and Spring Security rejects all business routes during setup.

## Preferred network arrangement

Run the production Spring Boot API on the approved EC2 instance and allow RDS PostgreSQL ingress from that EC2 security group, not the whole internet. Ensure the instances have appropriate VPC connectivity. Network access to the shared RDS instance is not database-level isolation: the SOS login must also have appropriately restricted database/schema privileges.

For workspace development, agree a secure connection arrangement or a dedicated reachable development target before changing any AWS settings. Do not assume the workspace has a permanent outbound IP for allowlisting.

## Database tooling

PostgreSQL is hosted on RDS, not EC2. Spring Boot connects using its JDBC driver; a PostgreSQL server installation on EC2 is unnecessary. The `postgresql-client` package is an optional diagnostic tool, not a deployment prerequisite. The user can perform SQL checks through pgAdmin instead; do not repeatedly require the same emptiness check through an EC2 command-line client.

Keep application schema changes in reviewed, versioned migrations. pgAdmin can execute SQL, but applying an initial migration manually does not create Flyway's migration history. Do not subsequently run the same migration through Flyway without an explicitly reviewed migration-history strategy; do not enable automatic baselining as a workaround.

## Read-only checks on EC2

From the existing EC2 SSH session, resolve the RDS hostname and test TCP access to its PostgreSQL port. For example, substitute the endpoint shown in RDS:

```sh
getent hosts YOUR_RDS_ENDPOINT
nc -vz -w 5 YOUR_RDS_ENDPOINT 5432
```

If `nc` is unavailable, use an existing PostgreSQL client or request installation of the appropriate Ubuntu utility. Never put a database password directly in a command shared in chat or shell history.

If the test fails, review the RDS-associated security group, EC2 security group, port, VPC routes, network ACLs and public/private access settings. A timeout alone does not distinguish these causes. Do not modify shared settings until the owner approves the exact change.

## Before any migration

1. Confirm the connection is to the expected database, including exact name/case. PostgreSQL folds unquoted identifiers to lowercase; the name entered by the user must be checked, not silently rewritten.
2. Inspect existing schemas and tables read-only. If data already exists, stop and agree a compatibility/backup plan.
3. Obtain explicit approval for development writes in SOS only.
4. Ensure the migration account has only the necessary SOS privileges and the runtime account is not the shared RDS administrator.
5. Verify the target before enabling Flyway. Keep clean/reset/baseline-on-migrate disabled.
6. Take the appropriate backup before applying changes. Enabling schema creation in Flyway must never be mistaken for approval to create another database.
7. Apply reviewed migrations in the SOS schema only, then verify constraints and cross-firm isolation.

The draft migration has **not** been executed or SQL-tested. It is not a production migration approval.

## EC2 release checklist — deployment deferred

- The intended web hostname is `sos.krishisetu9.in`; its DNS A record has been verified to resolve to the SOS EC2 address. DNS resolution alone does not verify deployment, reverse-proxy configuration or HTTPS.
- Use Java 21; build with `pnpm --filter @workspace/api-server run build`.
- The executable JAR is `artifacts/api-server/target/sos-api.jar`.
- Store database and owner-bootstrap credentials securely on AWS; workspace secrets do not automatically provision EC2.
- Supply the appropriate production connection settings and the AWS RDS CA bundle.
- Use a least-privilege service account and a managed process such as systemd.
- Serve the API over HTTPS through an approved reverse proxy/load balancer; do not expose login credentials over HTTP.
- Restrict the backend listening port and database ingress. Configure approved browser origins only once the frontend/HTTPS hostname is known.
- Verify backups, migrations, rollback recovery, restart behaviour and readiness.
- Complete onboarding/authentication/membership APIs and acceptance testing before calling this service production-ready.
- Native application release, AWS deployment and production migration remain separate approvals.
