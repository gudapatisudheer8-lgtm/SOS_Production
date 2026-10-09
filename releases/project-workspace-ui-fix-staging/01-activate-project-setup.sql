-- Run as the database administrator in pgAdmin's SOS Query Tool.
-- Changes only CSA's existing open-plotting assignment. No credentials or
-- operational data are changed. The chosen release comes from the database.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE
    firm uuid;
    assignment record;
    target record;
    owner_actor uuid;
BEGIN
    IF current_database() <> 'SOS' THEN
        RAISE EXCEPTION 'Wrong database: connect to SOS before running this script';
    END IF;
    SELECT id INTO STRICT firm
    FROM sos.firms WHERE upper(client_code) = 'CSA' FOR UPDATE;
    SELECT a.*, r.version INTO STRICT assignment
    FROM sos.firm_sector_assignments a
    JOIN sos.sectors s ON s.id = a.sector_id
    JOIN sos.sector_releases r ON r.id = a.release_id
    WHERE a.firm_id = firm AND s.code = 'open-plotting'
    FOR UPDATE OF a;
    IF NOT assignment.enabled THEN
        RAISE EXCEPTION 'Assignment is disabled; review it in the owner portal';
    END IF;
    SELECT r.id, r.label, r.version INTO STRICT target
    FROM sos.sector_releases r
    JOIN sos.project_setup_definitions d ON d.release_id = r.id
    WHERE r.sector_id = assignment.sector_id AND r.state = 'PUBLISHED'
      AND jsonb_typeof(d.definition->'sections') = 'array'
      AND d.definition->'sections' <> '[]'::jsonb
    ORDER BY r.version DESC LIMIT 1;
    IF target.version < assignment.version THEN
        RAISE EXCEPTION 'Refusing to downgrade the current release';
    END IF;
    IF target.id <> assignment.release_id THEN
        SELECT m.identity_id INTO STRICT owner_actor
        FROM sos.owner_memberships m
        JOIN sos.identities i ON i.id = m.identity_id
        WHERE i.enabled;
        UPDATE sos.firm_sector_assignments
        SET release_id = target.id
        WHERE firm_id = firm AND sector_id = assignment.sector_id;
        INSERT INTO sos.configuration_audit
            (id, actor_id, event, firm_id, release_id, event_data)
        VALUES (gen_random_uuid(), owner_actor, 'SECTOR_ASSIGNED', firm,
            target.id, jsonb_build_object('previousReleaseId',
            assignment.release_id, 'method', 'owner-approved SQL',
            'databaseOperator', current_user));
    END IF;
    RAISE NOTICE 'CSA assignment is now: % (version %)', target.label, target.version;
END $$;
COMMIT;

SELECT f.client_code, s.name AS sector_name, r.label AS assigned_release,
       r.version, (d.release_id IS NOT NULL) AS has_project_setup
FROM sos.firms f
JOIN sos.firm_sector_assignments a ON a.firm_id = f.id
JOIN sos.sectors s ON s.id = a.sector_id
JOIN sos.sector_releases r ON r.id = a.release_id
LEFT JOIN sos.project_setup_definitions d ON d.release_id = r.id
WHERE upper(f.client_code) = 'CSA' AND s.code = 'open-plotting';
