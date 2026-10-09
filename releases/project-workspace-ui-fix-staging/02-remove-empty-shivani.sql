-- Permanently removes ONLY the empty Shivani Infra project under CSA.
-- Take a fresh SOS backup and stop syndicateos-api first.
-- Aborts if any operational record, posting, file, audit or partner link exists.
-- Never disables triggers, deletes money, or resets the firm/users.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE
    firm uuid;
    project uuid;
    matches integer;
    owner_actor uuid;
BEGIN
    IF current_database() <> 'SOS' THEN
        RAISE EXCEPTION 'Wrong database: connect to SOS before running this script';
    END IF;
    SELECT id INTO STRICT firm
    FROM sos.firms WHERE upper(client_code) = 'CSA' FOR UPDATE;
    SELECT count(*) INTO matches FROM sos.projects
    WHERE firm_id = firm AND lower(btrim(name)) = 'shivani infra';
    IF matches = 0 THEN
        RAISE NOTICE 'Shivani Infra is already absent; nothing was deleted';
        RETURN;
    ELSIF matches <> 1 THEN
        RAISE EXCEPTION 'More than one matching project; nothing was deleted';
    END IF;
    SELECT id INTO STRICT project FROM sos.projects
    WHERE firm_id = firm AND lower(btrim(name)) = 'shivani infra'
    FOR UPDATE;
    IF EXISTS (SELECT 1 FROM sos.erp_records WHERE project_id = project)
       OR EXISTS (SELECT 1 FROM sos.erp_postings WHERE project_id = project)
       OR EXISTS (SELECT 1 FROM sos.erp_attachments WHERE project_id = project)
       OR EXISTS (SELECT 1 FROM sos.erp_audit WHERE project_id = project)
       OR EXISTS (SELECT 1 FROM sos.project_memberships WHERE project_id = project)
       OR EXISTS (SELECT 1 FROM sos.erp_inventory_reservations WHERE project_id = project)
    THEN
        RAISE EXCEPTION 'Project has linked history/data; removal blocked. Archive it instead';
    END IF;
    SELECT m.identity_id INTO STRICT owner_actor
    FROM sos.owner_memberships m
    JOIN sos.identities i ON i.id = m.identity_id
    WHERE i.enabled;
    -- Only setup/settings metadata is removed after the empty-project checks.
    DELETE FROM sos.project_setup_requests WHERE project_id = project;
    DELETE FROM sos.project_setup_sections WHERE project_id = project;
    DELETE FROM sos.erp_project_settings WHERE project_id = project;
    DELETE FROM sos.projects WHERE id = project AND firm_id = firm;
    INSERT INTO sos.configuration_audit
        (id, actor_id, event, firm_id, event_data)
    VALUES (gen_random_uuid(), owner_actor, 'EMPTY_PROJECT_REMOVED', firm,
        jsonb_build_object('projectId', project, 'projectName', 'Shivani Infra',
        'method', 'owner-approved SQL', 'databaseOperator', current_user));
    RAISE NOTICE 'Empty Shivani Infra project removed; firm and credentials preserved';
END $$;
COMMIT;

SELECT count(*) AS remaining_shivani_projects
FROM sos.projects p JOIN sos.firms f ON f.id = p.firm_id
WHERE upper(f.client_code) = 'CSA'
  AND lower(btrim(p.name)) = 'shivani infra';
