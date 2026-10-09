# SOS web-first release preparation

This is a deployment guide, not evidence of a deployment. AWS database changes
and application installation have not been performed by the agent. The workspace
continues to target RDS with writes disabled; its network cannot currently reach RDS.

## Built application

- React Native / Expo browser frontend: separate web-only `/owner` portal and
  company-code-first client entry with mobile/PIN and server-resolved roles.
  Accountant web is responsive; partner web is mobile-first. Native accountant
  and partner certification remains deferred; owner stays web-only.
- Java 21 / Spring Boot API, BCrypt credentials, opaque database-backed bearer
  sessions, first-login reset, role/firm/project isolation and controlled commands.
- Versioned PostgreSQL schema and plotting/construction interface seed data.
- No accounting, inventory, payments or financial balances in this foundation.

## Build

From the workspace root:

```sh
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/syndicateos-mobile run build:web
```

Outputs:

- `artifacts/api-server/target/sos-api.jar`
- `artifacts/syndicateos-mobile/web-dist/`
- Public RDS certificate: `artifacts/api-server/certs/aws-rds-global-bundle.pem`

The web build can use same-origin `/api` routing without a baked-in host.
For native builds, inject the approved API host through `EXPO_PUBLIC_DOMAIN`.
Never package credentials into the frontend, archive, repository or Java JAR.

## EC2 installation prerequisites

1. Use the dedicated SOS EC2 instance and Java 21. Do **not** install a PostgreSQL
   server: RDS is the database server and pgAdmin/psql are optional SQL clients.
2. Transfer the outputs using an approved secure method. Do not overwrite another
   application's files. Suggested layout: `/opt/syndicateos/` for the JAR, web
   assets and public CA certificate.
3. Run Java under a dedicated unprivileged service account and systemd, with
   protected configuration. Workspace secrets do not automatically exist on EC2.
4. Configure the approved hostname `sos.krishisetu9.in` in Nginx. Serve web assets,
   route `/api/` to the Spring Boot process without stripping `/api/`, and send
   other app routes to `index.html`.
5. Bind the Java service to loopback using `--server.address=127.0.0.1`; do not
   expose its internal port. Enable HTTPS with a trusted certificate before
   entering real login credentials. HTTP should redirect to HTTPS.
6. Review any shared security group before changes. Allow SSH from the
   administrator's current public IP only; web ports 80/443 as required. RDS port
   5432 should allow the SOS EC2 security group, not the entire internet.
7. Prefer an Elastic IP before release so the DNS record stays stable.

## Required server configuration

Use a protected server environment, never paste values into chat or command history:

- `SOS_DB_HOST`, `SOS_DB_PORT`, `SOS_DB_NAME` — exact approved target.
- `SOS_DB_USERNAME`, `SOS_DB_PASSWORD` — SOS-scoped PostgreSQL credentials.
- `SOS_RDS_CA_FILE` — absolute path to the public RDS CA bundle.
- `SOS_OWNER_MOBILE`, `SOS_OWNER_INITIAL_PASSWORD` — initial owner provisioning.
  The owner credential must contain at least eight characters and no more than
  72 UTF-8 bytes. It must be changed at the first login.
- `SOS_ALLOWED_ORIGINS` — exact approved browser origins if cross-origin access
  is needed. Same-origin Nginx deployment does not require a wildcard.
- `SOS_DB_READ_ONLY=false` — only when a writable SOS connection is approved.
- `SOS_ENABLE_WRITES=true` — only after migration/bootstrap verification.

Use separate appropriately privileged migration and least-privilege runtime
database accounts. Do not run the API using a shared RDS master account.
The runtime needs DML on SOS business tables, not access to sibling applications.

## Explicit, guarded initial setup

Do not apply the same migrations through both pgAdmin and Flyway. pgAdmin may run
inspection queries; this application tracks schema changes through Flyway.

With the owner's approval for the empty SOS development database, a writable
migration connection and protected bootstrap configuration supplied on EC2:

```sh
java -jar /opt/syndicateos/sos-api.jar \
  --server.address=127.0.0.1 \
  --sos.setup-approved=true \
  --sos.writes-enabled=false \
  --spring.datasource.hikari.read-only=false
```

The explicit setup operation:

- verifies the exact database name before DDL;
- refuses initial setup when existing non-system objects are present;
- applies versioned migrations with clean/reset and automatic baselining disabled;
- validates initial configurations and provisions the owner without logging credentials;
- never resets an existing owner's credential on repeat setup.

Once setup succeeds, stop this setup process. Start the normal service **without**
`--sos.setup-approved=true`, using the least-privilege runtime account and approved
writable runtime settings. Check `/api/readyz` locally; only a configured writable
service should be enabled for business access.

Production migration is a separate approval: take appropriate backups, review
permissions and recovery procedures, and do not treat development approval as
permission to modify a production environment.

## Verification still required on AWS

The schema, initial configurations and API onboarding journey passed isolated,
temporary PostgreSQL tests. This did not connect to or alter RDS.

Before release, verify from EC2: TLS SQL authentication, account privileges,
exact target, migration history, owner bootstrap, browser/API connectivity and
HTTPS. Then exercise owner → firm → accountant reset → project → partner reset,
cross-firm denial, suspension, identity reuse, configuration preview/publication
and browser refresh against the actual approved AWS environment.

## Updating the existing EC2 installation — portal release

The original installation, HTTPS, renewal and font delivery were confirmed.
This application-only update needs **no SQL migration, bootstrap, new domain
record or environment-file change**. Existing credentials and business data are
preserved. Old browser sessions must sign in again, and old unscoped partner
sessions are no longer accepted.

Download `releases/sos-portal-update.tar.gz` from the workspace Files panel.
This archive contains only the built JAR, public web assets and public RDS CA.
Check its SHA-256 against the value reported with the release before installation.

Portal archive SHA-256:
`ad092b31f455b3dabf83e9be68e1a3a17228ed559166711b4defe0b25f7c695d`

The owner onboarding → accountant reset/project/partner provisioning → partner
reset/read-only workspace journey passed browser verification against disposable
local PostgreSQL. Independent owner/client session restoration and wrong-company
denial were also verified. No customer or AWS database data was used in that test.

**Windows PowerShell:**

```powershell
scp -i "$env:USERPROFILE\Downloads\SOS.pem" "$env:USERPROFILE\Downloads\sos-portal-update.tar.gz" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$env:USERPROFILE\Downloads\SOS.pem" ubuntu@3.111.185.116
```

**EC2 terminal:** install during a brief maintenance window. Check the hash first.
The previous web directory and JAR are preserved as a backup; the protected
`/etc/syndicateos/sos.env`, database and current Nginx/HTTPS settings are untouched.

```sh
sha256sum "$HOME/sos-portal-update.tar.gz"
set -e
stage=$(mktemp -d /tmp/sos-portal-update.XXXXXX)
tar -xzf "$HOME/sos-portal-update.tar.gz" -C "$stage"
test -f "$stage/sos-api.jar"
test -f "$stage/web/index.html"
stamp=$(date +%Y%m%d-%H%M%S)
backup="/opt/syndicateos/backups/$stamp"
next="/opt/syndicateos/web-next-$stamp"
sudo mkdir -p "$backup"
sudo cp -a /opt/syndicateos/sos-api.jar "$backup/sos-api.jar"
sudo cp -a "$stage/web" "$next"
sudo chown -R root:root "$next"
sudo find "$next" -type d -exec chmod 755 {} \;
sudo find "$next" -type f -exec chmod 644 {} \;
sudo systemctl stop syndicateos-api
sudo install -o root -g sos-api -m 640 "$stage/sos-api.jar" /opt/syndicateos/sos-api.jar
sudo mv /opt/syndicateos/web "$backup/web"
sudo mv "$next" /opt/syndicateos/web
sudo systemctl start syndicateos-api
sudo systemctl is-active syndicateos-api
echo "Application backup: $backup"
```

Allow about ten seconds for Spring Boot to start, then:

```sh
curl --fail --silent --show-error https://sos.krishisetu9.in/api/readyz
```

Expect HTTP 200 with `status: ready`. If startup fails, stop here and inspect
`sudo journalctl -u syndicateos-api -n 60 --no-pager`; do not re-run schema setup.
Refresh the browser with Ctrl+F5:

- Clients: `https://sos.krishisetu9.in/` — company code, then mobile/PIN.
- Owner: `https://sos.krishisetu9.in/owner` — owner mobile/password, web-only.

The existing SPA fallback serves `/owner`. Preserve the explicit
`location ^~ /assets/ { try_files $uri =404; }` before the hidden-file deny rule
so exported `.pnpm` font paths continue working.
