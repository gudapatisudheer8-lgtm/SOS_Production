#!/usr/bin/env python3
"""Explicit, firm-scoped configuration rollout. Never edits posted money."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--firm-code", required=True)
    args = parser.parse_args()
    code = args.firm_code.strip().upper()
    if not re.fullmatch(r"[A-Z0-9-]{3,32}", code):
        raise SystemExit("Invalid firm code.")
    base = Path("/opt/syndicateos/current")
    target = json.loads((base / "deployment.json").read_text())
    if target["release"] != "sos-fresh-ec2-20261010" or target["database_name"] != "sos":
        raise SystemExit("Unexpected deployment or database; no changes made.")
    env = os.environ.copy()
    for key in list(env):
        if key.startswith("PG"):
            env.pop(key)
    env.update(PGPASSWORD=getpass.getpass("sos_deploy database password (hidden): "),
               PGSSLMODE="verify-full", PGSSLROOTCERT=str(base / "certs/aws-rds-global-bundle.pem"),
               PGCONNECT_TIMEOUT="10")

    def sql(statement):
        result = subprocess.run(
            ["psql", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1",
             "-h", target["database_host"], "-p", str(target["database_port"]),
             "-U", target["migration_role"], "-d", "sos"],
            input=statement, text=True, capture_output=True, env=env)
        if result.returncode:
            raise RuntimeError(result.stderr.strip())
        return result.stdout.strip()

    query = f"""
      SELECT row_to_json(x) FROM (
        SELECT f.id AS firm_id,f.client_code,r.id AS release_id,r.label,
               a.sector_id,e.review_roles,e.approval_count
        FROM sos.firms f JOIN sos.firm_sector_assignments a ON a.firm_id=f.id
        JOIN sos.sectors s ON s.id=a.sector_id
        JOIN sos.sector_releases r ON r.id=a.release_id
        JOIN sos.erp_resources e ON e.release_id=r.id AND e.kind='drawings'
        WHERE f.client_code='{code}' AND s.code='open-plotting' AND a.enabled
      ) x;
    """
    rows = sql(query).splitlines()
    if len(rows) != 1:
        raise SystemExit("Expected one enabled Open Plotting assignment; no changes made.")
    before = json.loads(rows[0])
    print("Confirmed target:", json.dumps(before))
    if "PARTNER" in before["review_roles"]:
        print("Partner drawing review is already enabled. No database changes made.")
        return
    print("This publishes a copied configuration and switches ONLY this firm's Open Plotting assignment.")
    print("Approval counts, self-approval restrictions, requests, accounts and posted balances stay unchanged.")
    if input(f"Type APPLY to enable other-partner drawing review for {code}: ").strip() != "APPLY":
        raise SystemExit("Cancelled. No changes made.")
    helper = (Path(__file__).parent / "sql/03_partner_drawing_release.sql").read_text()
    result = sql(f"""
      BEGIN;
      SET LOCAL lock_timeout='10s';
      SET LOCAL statement_timeout='60s';
      {helper}
      DO $apply$
      DECLARE new_release uuid;
      BEGIN
        PERFORM 1 FROM sos.firm_sector_assignments WHERE firm_id='{before['firm_id']}'
          AND sector_id='{before['sector_id']}' AND release_id='{before['release_id']}' FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Assignment changed; recheck before applying'; END IF;
        new_release:=sos.clone_partner_drawing_release('{before['release_id']}');
        UPDATE sos.firm_sector_assignments SET release_id=new_release
          WHERE firm_id='{before['firm_id']}' AND sector_id='{before['sector_id']}';
      END $apply$;
      {query}
      COMMIT;
    """)
    print("Drawing review configuration applied:", result)
    print("No financial entries, balances, passwords or API service were changed.")
    print("Sign out and sign in again as the OTHER project partner.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        raise SystemExit(str(error))
