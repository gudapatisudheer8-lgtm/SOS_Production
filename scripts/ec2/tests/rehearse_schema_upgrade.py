#!/usr/bin/env python3
"""Rehearse V19 -> V22 on disposable loopback databases, never the customer's DB."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
HOST = "127.0.0.1"
PORT = "55439"
PREFIX = f"sos_ec2_rehearsal_{time.time_ns()}"
DEPLOY = PREFIX + "_deploy"
RUNTIME = PREFIX + "_runtime"
RESTORE = PREFIX + "_restore"
ENV = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/tmp"), "LANG": "C.UTF-8",
       "PGHOST": HOST, "PGPORT": PORT, "PGSSLMODE": "disable", "PGCONNECT_TIMEOUT": "5"}


def run(command, **kwargs):
    return subprocess.run(command, check=True, env=ENV, **kwargs)


def sql(database, command, role="sos_test"):
    try:
        return run(["psql", "-X", "--no-password", "-U", role, "-d", database,
                    "-v", "ON_ERROR_STOP=1", "-tA", "-c", command],
                   capture_output=True, text=True).stdout.strip()
    except subprocess.CalledProcessError as error:
        print(error.stderr)
        raise


def setup(jar, log, upgrade=False):
    flags = [
        "--spring.datasource.url=jdbc:postgresql://127.0.0.1:55439/" + PREFIX + "?sslmode=disable",
        "--spring.datasource.username=" + DEPLOY, "--spring.datasource.password=",
        "--spring.datasource.hikari.read-only=false", "--sos.database-name=" + PREFIX,
        "--server.address=127.0.0.1", "--server.port=8096",
        "--sos.setup-approved=true", "--sos.setup-exit=true", "--sos.writes-enabled=false",
        "--sos.preview-fixture=false", "--spring.flyway.enabled=false",
    ]
    flags += ["--sos.upgrade-only=true"] if upgrade else [
        "--SOS_OWNER_MOBILE=+919000000099", "--SOS_OWNER_INITIAL_PASSWORD=Public-rehearsal-fixture-123"]
    with log.open("w") as stream:
        run(["java", "-Xms64m", "-Xmx256m", "-jar", str(jar), *flags],
            stdout=stream, stderr=subprocess.STDOUT, timeout=180)


SNAPSHOT = """SELECT json_build_object(
    'identity_hash',(SELECT md5(coalesce(string_agg(id::text||credential_hash||must_change_credential::text,'' ORDER BY id),'')) FROM sos.identities),
    'owners',(SELECT count(*) FROM sos.owner_memberships),
    'firms',(SELECT count(*) FROM sos.firms),
    'record_hash',(SELECT md5(coalesce(string_agg(id::text||status||data::text,'' ORDER BY id),'')) FROM sos.erp_records),
    'pending',(SELECT count(*) FROM sos.erp_records WHERE status='pending'),
    'postings',(SELECT count(*) FROM sos.erp_postings))"""


def main():
    baseline = ROOT / "generated-artifacts/ec2/sos-fresh-ec2-20261010/sos-api.jar"
    current = ROOT / "artifacts/api-server/target/sos-api.jar"
    if not baseline.is_file() or not current.is_file():
        raise SystemExit("Build current JAR and retain the original V19 package first.")
    if not PREFIX.startswith("sos_ec2_rehearsal_") or HOST != "127.0.0.1":
        raise SystemExit("Invalid isolated rehearsal target.")
    created = False
    restored = False
    roles = False
    with tempfile.TemporaryDirectory(prefix="sos-upgrade-rehearsal-") as directory:
        work = Path(directory)
        try:
            sql("postgres", f"CREATE ROLE {DEPLOY} LOGIN; CREATE ROLE {RUNTIME} NOLOGIN;")
            roles = True
            run(["createdb", "--no-password", "-U", "sos_test", "-O", DEPLOY, PREFIX])
            created = True
            setup(baseline, work / "baseline.log")
            assert sql(PREFIX, "SELECT max(version::integer) FROM sos.flyway_schema_history WHERE success", DEPLOY) == "19"
            sql(PREFIX, """
                DO $seed$
                DECLARE actor uuid; firm uuid := gen_random_uuid(); project uuid := gen_random_uuid();
                        release uuid; sector uuid;
                BEGIN
                  SELECT identity_id INTO actor FROM sos.owner_memberships LIMIT 1;
                  SELECT id,sector_id INTO release,sector FROM sos.sector_releases WHERE state='PUBLISHED' LIMIT 1;
                  INSERT INTO sos.firms(id,client_code,name,created_by) VALUES(firm,'REHEARSAL','Disposable upgrade fixture',actor);
                  INSERT INTO sos.firm_sector_assignments(firm_id,sector_id,release_id) VALUES(firm,sector,release);
                  INSERT INTO sos.projects(id,firm_id,sector_id,name,created_by,setup_state,setup_release_id,details)
                    VALUES(project,firm,sector,'Disposable project',actor,'READY',release,'{}');
                  INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,status,created_by,request_id)
                    VALUES(gen_random_uuid(),project,firm,'accounts','{"accountName":"Fixture bank","openingBalance":1500}','{}','approved',actor,gen_random_uuid()),
                          (gen_random_uuid(),project,firm,'investments','{"amount":900,"partnerName":"Fixture only"}','{}','pending',actor,gen_random_uuid());
                END $seed$;
            """, DEPLOY)
            before = json.loads(sql(PREFIX, SNAPSHOT, DEPLOY))
            assert before["pending"] == 1 and before["postings"] == 0
            run(["pg_dump", "--no-password", "-U", DEPLOY, "-d", PREFIX,
                 "--schema=sos", "--format=custom", "--no-owner", "--no-acl", "-f", str(work / "sos.dump")])
            setup(current, work / "upgrade.log", upgrade=True)
            after = json.loads(sql(PREFIX, SNAPSHOT, DEPLOY))
            assert before == after, "Identity, record or posting data changed during additive upgrade."
            assert sql(PREFIX, "SELECT max(version::integer) FROM sos.flyway_schema_history WHERE success", DEPLOY) == "22"
            permissions = (ROOT / "scripts/ec2/sql/03_update_runtime_permissions.sql").read_text()
            permissions = permissions.replace("'sos'", "'" + PREFIX + "'").replace("sos_deploy", DEPLOY).replace("sos_runtime", RUNTIME)
            sql(PREFIX, permissions, DEPLOY)
            privileges = sql(PREFIX, f"""SELECT bool_and(has_table_privilege('{RUNTIME}',t,p))
                FROM unnest(ARRAY['sos.project_blueprints','sos.project_notifications','sos.project_notification_reads',
                  'sos.plot_registrations','sos.registration_jobs','sos.browser_push_subscriptions','sos.browser_push_deliveries']) t,
                     unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p""", DEPLOY)
            assert privileges == "t", "Added tables missing runtime privileges."
            run(["createdb", "--no-password", "-U", "sos_test", "-O", DEPLOY, RESTORE])
            restored = True
            run(["pg_restore", "--no-password", "-U", DEPLOY, "-d", RESTORE,
                 "--no-owner", "--no-acl", str(work / "sos.dump")])
            assert json.loads(sql(RESTORE, SNAPSHOT, DEPLOY)) == before
            print("PASS: V19 -> V22 preserves existing identities, firm and records; legacy pending money stays unposted.")
            print("PASS: added-table runtime privileges and actual pg_dump/pg_restore recovery verified locally.")
        except Exception:
            for name in ("baseline.log", "upgrade.log"):
                log = work / name
                if log.exists():
                    print(name + " (last lines):\n" + "\n".join(log.read_text().splitlines()[-15:]))
            raise
        finally:
            if restored:
                run(["dropdb", "--no-password", "-U", "sos_test", RESTORE])
            if created:
                run(["dropdb", "--no-password", "-U", "sos_test", PREFIX])
            if roles:
                sql("postgres", f"DROP ROLE {RUNTIME}; DROP ROLE {DEPLOY};")


if __name__ == "__main__":
    main()
