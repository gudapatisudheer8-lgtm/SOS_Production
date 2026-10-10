-- Run as the RDS database administrator, connected to lowercase database sos.
-- This does NOT drop a database, schema, role, or application table.
-- Passwords are set separately using psql's hidden \password prompt.
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'sos' THEN
    RAISE EXCEPTION 'Wrong database. Connect to lowercase sos before continuing.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_toast%'
      AND c.relkind IN ('r','p','v','m','S','f')
  ) THEN
    RAISE EXCEPTION 'Fresh setup requires an empty database. No changes made.';
  END IF;

  -- Deliberately use new names, not the previous deployment's database roles.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sos_deploy') THEN
    CREATE ROLE sos_deploy NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sos_runtime') THEN
    CREATE ROLE sos_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname IN ('sos_deploy','sos_runtime')
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) OR EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE member IN (SELECT oid FROM pg_roles
                     WHERE rolname IN ('sos_deploy','sos_runtime'))
  ) THEN
    RAISE EXCEPTION 'These role names have elevated privileges or inherited roles. Stop and review.';
  END IF;
END
$guard$;

-- Only this newly recreated database is affected, not other RDS databases.
REVOKE ALL ON DATABASE sos FROM PUBLIC;
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE sos TO sos_deploy;
GRANT CONNECT ON DATABASE sos TO sos_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

COMMIT;

SELECT current_database() AS verified_database;
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles WHERE rolname IN ('sos_deploy','sos_runtime') ORDER BY rolname;
