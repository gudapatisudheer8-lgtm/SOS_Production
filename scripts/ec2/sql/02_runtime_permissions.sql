-- Run after Flyway/bootstrap as sos_deploy in lowercase database sos.
-- The guarded initializer invokes this file automatically.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'sos' OR current_user <> 'sos_deploy' THEN
    RAISE EXCEPTION 'Permissions must be applied as sos_deploy in lowercase sos.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM sos.flyway_schema_history
    WHERE version = '19' AND success
  ) OR NOT EXISTS (SELECT 1 FROM sos.owner_memberships) THEN
    RAISE EXCEPTION 'Migrations or owner initialization are incomplete.';
  END IF;
END
$guard$;

GRANT USAGE ON SCHEMA sos TO sos_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sos TO sos_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sos TO sos_runtime;
REVOKE ALL ON TABLE sos.flyway_schema_history FROM sos_runtime;
GRANT SELECT ON TABLE sos.flyway_schema_history TO sos_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE sos_deploy IN SCHEMA sos
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sos_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE sos_deploy IN SCHEMA sos
  GRANT USAGE, SELECT ON SEQUENCES TO sos_runtime;
COMMIT;

SELECT version, description, success FROM sos.flyway_schema_history
ORDER BY installed_rank;
SELECT count(*) AS owner_count FROM sos.owner_memberships;
SELECT count(*) AS firms_should_be_zero FROM sos.firms;
SELECT s.code, r.version, r.label, r.state
FROM sos.sector_releases r JOIN sos.sectors s ON s.id = r.sector_id
WHERE r.state = 'PUBLISHED' ORDER BY s.code, r.version;
