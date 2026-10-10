# SyndicateOS — fresh EC2 / RDS installation

Release: **sos-fresh-ec2-20261010**. These instructions replace earlier SOS update guides.
No AWS installation or database modification has been performed by Replit Agent.

## Confirmed targets

| Setting | Value |
|---|---|
| EC2 public IP | `3.111.185.116` |
| Website | `https://sos.krishisetu9.in/` |
| Owner login | `https://sos.krishisetu9.in/owner` |
| RDS endpoint | `krishisetu-db.cpmomccww28x.ap-south-1.rds.amazonaws.com` |
| PostgreSQL database | **`sos` — lowercase**, NOT the old `SOS` |
| Schema | `sos` |
| Migration user | `sos_deploy` — new, dedicated role |
| Application user | `sos_runtime` — new, dedicated role |
| Stack | React production web build + Java 21 Spring Boot + PostgreSQL |
| Included migrations | V1 through V19 |

This package installs the Preview-approved WEB application, including the accountant
and mobile-friendly partner dashboards. It does not distribute an Android/iOS
binary. Native-app store builds are a separate delivery.

**Fresh database warning:** previous firms, projects, PINs, users, and financial
records are not recreated. The only initial application identity is the owner.
Existing private file bytes are preserved, but a deleted database's attachment
metadata will not reappear without a matching database backup.

**Do not run `rm -rf`, drop databases, delete certificates, or clear all Nginx sites.**
The installer archives only the named SOS installation. Other applications, the
existing TLS certificate, SSH configuration, and private uploads remain in place.

## 1. Back up and check AWS

1. Take an EC2 snapshot/AMI before changing files. If the RDS instance is shared,
   take an RDS snapshot without deleting or recreating the instance.
2. Confirm the `sos` database has no application tables. Do not recreate it again.
3. Confirm DNS for `sos.krishisetu9.in` still points to the approved EC2 address.
4. EC2: allow 80/443 publicly as needed, and SSH only from your administrator IP.
   Do not expose ports 8080/8091. RDS 5432 must allow the EC2 security group, not
   `0.0.0.0/0`. EC2 must have VPC/network access to this RDS endpoint.
5. Keep existing HTTPS renewal enabled. Do not reinstall/reset the certificate.
6. Recommendation: at least 2 GB RAM for comfortable headroom, sufficient free
   disk, RDS automatic backups, and a private off-instance upload backup.

## 2. Upload and verify the NEW archive

Download only **sos-fresh-ec2-20261010.tar.gz** from this handoff. Do not reuse an
old `sos-simple-open-plotting` or `sos-project-setup-ui-fix` package.

Windows PowerShell:

```powershell
scp -i "$env:USERPROFILE\Downloads\SOS.pem" "$env:USERPROFILE\Downloads\sos-fresh-ec2-20261010.tar.gz" ubuntu@3.111.185.116:/home/ubuntu/
ssh -i "$env:USERPROFILE\Downloads\SOS.pem" ubuntu@3.111.185.116
```

Use the **inline checksum command from the release message** to verify/extract.
It is deliberately self-contained: no separately uploaded `.sha256` is required.
Fail-fast commands must run inside `( ... )`, not `set -e` in your interactive
SSH session. A failed check must not log you out.

After successful extraction:

```bash
cd /home/ubuntu/sos-fresh-ec2-20261010
sha256sum -c FILES.sha256
```

Do not extract over an existing directory. If the directory already exists, stop
and verify it rather than mixing files from different packages.

## 3. Inspect prerequisites — does not install the application

```bash
sudo python3 deploy.py inspect
```

Required on Ubuntu: **Java 21**, Python 3, PostgreSQL client (`psql`), Nginx,
curl, systemd. No Node.js, pnpm, Maven, or local PostgreSQL server is required.
If a prerequisite is missing:

```bash
sudo apt-get update
sudo apt-get install -y openjdk-21-jre-headless python3 postgresql-client nginx curl ca-certificates
java -version
```

`java -version` must report 21. If another Java version is selected, use
`sudo update-alternatives --config java` and choose Java 21.
Do not perform an unrelated full OS upgrade during the application cutover.

If `nginx -t` fails, correct that before staging. If the current SOS unit or its
directory is different from `/opt/syndicateos`, stop and send only its file paths
and service status; do not paste environment-file contents.

## 4. Fresh database SQL and hidden password prompts

Run this BEFORE staging, while no new application writes are possible.
Use the RDS **administrator username**, not `sos_deploy` or `sos_runtime`.
Never post passwords in chat, SQL screenshots, or shell command arguments.

From the extracted package:

```bash
read -r -p "RDS administrator username: " RDS_ADMIN
PGSSLMODE=verify-full \
PGSSLROOTCERT="$PWD/certs/aws-rds-global-bundle.pem" \
psql -X -W \
  -h krishisetu-db.cpmomccww28x.ap-south-1.rds.amazonaws.com \
  -p 5432 -U "$RDS_ADMIN" -d sos
```

Enter the administrator password at psql's hidden prompt. At the `sos=>` prompt:

```sql
\set ON_ERROR_STOP on
\i sql/01_prepare_database.sql
\password sos_deploy
\password sos_runtime
ALTER ROLE sos_deploy LOGIN;
ALTER ROLE sos_runtime LOGIN;
\q
```

Choose **different passwords of at least 16 characters** for these two roles.
Store them in your password manager. The `\password` commands prompt twice
without printing the password or putting plaintext into your SQL history.

If SQL fails, stop. Do not run the remaining password/LOGIN commands. `BEGIN`
guards the role/grant preparation so an error rolls it back when you disconnect.

For pgAdmin users: `sql/01_prepare_database.sql` is the same fresh role/permission
SQL and can be run against lowercase `sos`. Set the two new role passwords using
pgAdmin's role properties and enable Login. Do NOT run the 19 application table
migrations manually in pgAdmin; the guarded initializer tracks them through Flyway.

SQL is scoped to database `sos`. It does not change the RDS administrator role,
drop anything, grant access to other databases, or reuse the old app's role names.
If either proposed role already has elevated privileges/inherited roles, SQL stops.
Review any pre-existing roles' permissions on other databases before reusing them.

## 5. Archive the old SOS deployment and stage the new one

This starts the maintenance window; the old SOS API will be stopped.

```bash
sudo python3 deploy.py stage
```

At the confirmation prompt type **INSTALL FRESH SOS**.

The phase:

- checks Java, Nginx, disk space, and package checksums before stopping SOS;
- saves Nginx, SOS environment, and service configuration in a root-only archive;
- moves `/opt/syndicateos` to `/opt/syndicateos-archives/<UTC timestamp>/old-install`;
- archives old SOS environment files and service drop-ins;
- installs a new root-owned release under `/opt/syndicateos/releases/`;
- creates the `/opt/syndicateos/current` symlink;
- provisions a dedicated unprivileged `syndicateos` service user;
- preserves `/var/lib/syndicateos/uploads` and makes it available to that service;
- installs a localhost-only systemd unit and a Nginx location snippet;
- leaves the API stopped.

The stage is intentionally not a repeating cleanup command. Do not run it twice.
Keep the archive until production acceptance and backup recovery are confirmed.
Old upload archives in `/home/ubuntu` do not run; leave them until successful
acceptance, then remove only explicitly identified old SOS archives if desired.

## 6. Write the protected runtime configuration

```bash
sudo python3 /opt/syndicateos/current/deploy.py configure
```

Enter the **sos_runtime** password from step 4.
The phase saves `/etc/syndicateos/runtime.env` with root-only permissions.
It contains the exact lowercase target, verified RDS TLS, business-write setting,
and approved HTTPS origin. It does not contain the initial owner credential.
Do not print/cat this file or paste it into chat.

## 7. Initialize tables, configuration, and owner

```bash
sudo python3 /opt/syndicateos/current/deploy.py initialize
```

Prompts:

1. **sos_deploy** password from step 4.
2. Your owner mobile including country code (`+91...`).
3. Your initial owner password: at least 8 characters, at most 72 UTF-8 bytes.
4. Type **INITIALIZE sos**.

This verifies TLS connectivity and database name, runs guarded Flyway setup on
loopback port 8091, validates configuration, provisions the owner, exits the
setup process, and automatically runs `sql/02_runtime_permissions.sql`.
The normal API remains stopped. The migration connection is not saved in the
runtime configuration. Existing owner credentials are never reset on a retry.

Expected: 19 successful migrations, one owner, zero firms. Business master
definitions/configuration are initialized; no example projects or money are seeded.

If interrupted or failed, inspect the error. Never delete migration history,
edit already applied SQL, or run Flyway clean/baseline to bypass a failure.
Initialization may be resumed after correcting the actual problem; do not repeat
the fresh-role preparation SQL after application tables exist.

## 8. Connect the existing HTTPS Nginx site to the new release

Find the SOS site:

```bash
sudo grep -R -l 'server_name.*sos\.krishisetu9\.in' /etc/nginx/sites-available
```

Edit the SOS configuration file returned by that command with `sudo nano <file>`.
In its **HTTPS (`listen 443 ...`) server block for sos.krishisetu9.in**:

- retain `listen`, `server_name`, SSL certificate/renewal settings;
- retain any explicit ACME challenge block required for renewal;
- replace the old application `root`, `index`, `client_max_body_size`, and
  old `/`, `/api`, `/assets`, and related application location blocks with:

```nginx
include /etc/nginx/snippets/syndicateos-fresh.conf;
```

Do not add duplicate `location /` or `/api/` blocks. Do not include it in another
app's site or in the HTTP-to-HTTPS redirect block. Do not clear `sites-enabled`.
If multiple enabled server blocks use the SOS hostname, resolve only those
duplicates; keep other applications' enabled sites.

```bash
sudo nginx -t
```

If HTTPS is not already configured/working, stop here. TLS setup requires separate
inspection; do not send real credentials over HTTP.

## 9. Start and verify

```bash
sudo python3 /opt/syndicateos/current/deploy.py activate
sudo systemctl status syndicateos-api --no-pager
```

Activation starts the API, waits for **database-backed readiness**, reloads
Nginx only after that passes, and verifies both the exact release and `/api/readyz`
through local HTTPS with normal certificate verification. It enables startup at
boot only after these checks pass.

From your computer/browser:

- `https://sos.krishisetu9.in/release.json` must say `sos-fresh-ec2-20261010`.
- `https://sos.krishisetu9.in/api/readyz` must say `"status":"ready"`.
- Owner: **https://sos.krishisetu9.in/owner**
- Accountant/partner: **https://sos.krishisetu9.in/**

Use a private browser window initially, so a previous session token/firm selection
does not confuse the fresh installation.

## 10. Signed-in acceptance — do this before real business entry

1. Sign in as owner using the mobile/password supplied during initialization;
   complete the mandatory credential change.
2. Create your actual firm and its accountant. Follow the issued initial
   credential/reset flow, rather than assuming an old PIN will still exist.
3. For open plotting, explicitly assign the latest published release labelled
   **Simple open plotting · [sector name]**. Inspect the published release list;
   do not select a legacy original-dashboard release by mistake.
4. Verify accountant Add Project is the compact Preview-approved form.
5. Create an intended project, check partner allocation/budget checks,
   upload a plan, and confirm the project-specific Cash account plus any bank.
6. Sign in as a project partner; verify firm/project filtering.
7. In an intentionally separate validation firm/project, check pending versus
   approved investment, expense, drawing, and booking receipt entries:
   - pending submissions do not change cleared balances;
   - eligible non-submitters see approval controls and pending badges;
   - self-approval remains blocked while the project has partners;
   - approval posts once to the selected Cash/bank account;
   - accountant and partner project statements agree after refresh;
   - Cash booking receipts credit Cash, not the first bank account.
8. Check marketing personal invitations in a separate browser: invitation login
   and first-access credential reset, no accountant dashboard/session exposure.
9. Check uploaded plan/receipt access for authorized users and denial for others.
10. Do not enter fictitious financial records into a real project just to test.
    Keep validation records separate and clearly labelled; the package does not
    create a test firm automatically or provide destructive cleanup SQL.

## Errors and recovery

Stop at the failed phase; do not paste a whole old installation script again.

```bash
sudo journalctl -u syndicateos-api -n 80 --no-pager
sudo systemctl status syndicateos-api --no-pager
sudo nginx -t
```

Share only the error output, not passwords, token values, or runtime.env contents.
An HTTP 200 health response does not prove database readiness or the correct UI.

The old application/configuration archive is for recovery, not an automatic
database rollback. The former database has already been deleted/recreated;
restoring the old JAR alone cannot restore old firms/transactions. To restore old
data, a compatible database backup and matching private uploads are required.
Do not point the new database at an old application as a guessed rollback.

After acceptance: confirm RDS backup retention and take a logical `sos` backup;
back up private uploads and their database metadata together. Keep old archives
until a recovery test succeeds. Prefer private S3 for uploads before deploying
multiple application instances.
