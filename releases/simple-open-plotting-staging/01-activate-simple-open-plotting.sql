-- Run only after upgrade.py has successfully migrated the SOS database through V8.
-- This explicitly changes CSA's open-plotting release, not its data or credentials.
BEGIN;
DO $$
DECLARE firm uuid; assignment record; target record; owner_actor uuid;
BEGIN
 IF current_database()<>'SOS' THEN RAISE EXCEPTION 'Run this only in the SOS database'; END IF;
 SELECT id INTO STRICT firm FROM sos.firms WHERE upper(client_code)='CSA' FOR UPDATE;
 SELECT a.*,r.version INTO STRICT assignment FROM sos.firm_sector_assignments a
 JOIN sos.sectors s ON s.id=a.sector_id JOIN sos.sector_releases r ON r.id=a.release_id
 WHERE a.firm_id=firm AND s.code='open-plotting' FOR UPDATE OF a;
 IF NOT assignment.enabled THEN RAISE EXCEPTION 'Open plotting is disabled for CSA; enable it in the owner console before assigning the new release'; END IF;
 SELECT r.id,r.version,r.label INTO STRICT target FROM sos.sector_releases r
 JOIN sos.project_setup_definitions d ON d.release_id=r.id
 WHERE r.sector_id=assignment.sector_id AND r.state='PUBLISHED'
 AND d.definition->>'presentation'='open-plotting-simple'
 ORDER BY r.version DESC LIMIT 1;
 IF target.version<assignment.version THEN RAISE EXCEPTION 'Refusing to downgrade the release'; END IF;
 IF target.id<>assignment.release_id THEN
  SELECT m.identity_id INTO STRICT owner_actor FROM sos.owner_memberships m
  JOIN sos.identities i ON i.id=m.identity_id WHERE i.enabled;
  UPDATE sos.firm_sector_assignments SET release_id=target.id WHERE firm_id=firm AND sector_id=assignment.sector_id;
  INSERT INTO sos.configuration_audit(id,actor_id,event,firm_id,release_id,event_data)
  VALUES(gen_random_uuid(),owner_actor,'SECTOR_ASSIGNED',firm,target.id,
   jsonb_build_object('previousReleaseId',assignment.release_id,'method','owner-approved SQL','databaseOperator',current_user));
 END IF;
 RAISE NOTICE 'CSA assigned release: % (version %)',target.label,target.version;
END $$;
GRANT USAGE ON SCHEMA sos TO sos_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA sos TO sos_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA sos TO sos_app;
COMMIT;
SELECT f.client_code,r.label,r.version,d.definition->>'presentation' AS presentation
FROM sos.firms f JOIN sos.firm_sector_assignments a ON a.firm_id=f.id
JOIN sos.sectors s ON s.id=a.sector_id JOIN sos.sector_releases r ON r.id=a.release_id
JOIN sos.project_setup_definitions d ON d.release_id=r.id
WHERE upper(f.client_code)='CSA' AND s.code='open-plotting';
