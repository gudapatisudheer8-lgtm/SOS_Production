-- Publish a corrected COPY, never edit an immutable published release.
-- This helper does not switch any firm or change financial records.
CREATE OR REPLACE FUNCTION sos.clone_partner_drawing_release(source_release uuid)
RETURNS uuid LANGUAGE plpgsql AS $body$
DECLARE src sos.sector_releases%ROWTYPE; target uuid; next_version integer; ids jsonb;
BEGIN
 SELECT * INTO STRICT src FROM sos.sector_releases WHERE id=source_release;
 IF src.state<>'PUBLISHED' THEN RAISE EXCEPTION 'Source release must be published'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sos.erp_resources WHERE release_id=source_release AND kind='drawings')
 THEN RAISE EXCEPTION 'This release has no drawing workflow'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sos.permission_grants WHERE release_id=source_release AND role_code='PARTNER' AND permission_key='erp.review')
 THEN RAISE EXCEPTION 'Partner ERP review is not enabled; review this custom release separately'; END IF;
 -- Serialize version allocation without touching old configuration rows.
 PERFORM 1 FROM sos.sectors WHERE id=src.sector_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM sos.erp_resources WHERE release_id=source_release AND kind='drawings' AND 'PARTNER'=ANY(review_roles))
 THEN RETURN source_release; END IF;
 SELECT coalesce(max(version),0)+1 INTO next_version FROM sos.sector_releases WHERE sector_id=src.sector_id;
 target:=gen_random_uuid();
 INSERT INTO sos.sector_releases(id,sector_id,version,label,state)
 VALUES(target,src.sector_id,next_version,left('Partner drawing review · '||src.label,120),'DRAFT');
 SELECT coalesce(jsonb_object_agg(id::text,gen_random_uuid()::text),'{}'::jsonb) INTO ids FROM (
   SELECT id FROM sos.sector_interfaces WHERE release_id=source_release UNION ALL
   SELECT id FROM sos.interface_screens WHERE release_id=source_release UNION ALL
   SELECT id FROM sos.screen_components WHERE release_id=source_release UNION ALL
   SELECT id FROM sos.option_sets WHERE release_id=source_release UNION ALL
   SELECT id FROM sos.field_definitions WHERE release_id=source_release
 ) x;
 INSERT INTO sos.sector_interfaces
 SELECT (ids->>x.id::text)::uuid,target,x.role_code,x.title FROM sos.sector_interfaces x WHERE release_id=source_release;
 INSERT INTO sos.interface_screens
 SELECT (ids->>x.id::text)::uuid,target,(ids->>x.interface_id::text)::uuid,x.key,x.label,x.position FROM sos.interface_screens x WHERE release_id=source_release;
 INSERT INTO sos.screen_components
 SELECT (ids->>x.id::text)::uuid,target,(ids->>x.screen_id::text)::uuid,x.component_key,x.data_source_key,x.props,x.position FROM sos.screen_components x WHERE release_id=source_release;
 INSERT INTO sos.option_sets
 SELECT (ids->>x.id::text)::uuid,target,x.key FROM sos.option_sets x WHERE release_id=source_release;
 INSERT INTO sos.options
 SELECT gen_random_uuid(),target,(ids->>x.option_set_id::text)::uuid,x.value,x.label,x.position FROM sos.options x WHERE release_id=source_release;
 INSERT INTO sos.field_definitions
 SELECT (ids->>x.id::text)::uuid,target,x.key,x.label,x.kind,x.required,(ids->>x.option_set_id::text)::uuid,x.constraints FROM sos.field_definitions x WHERE release_id=source_release;
 INSERT INTO sos.form_fields
 SELECT target,(ids->>x.component_id::text)::uuid,(ids->>x.field_id::text)::uuid,x.position FROM sos.form_fields x WHERE release_id=source_release;
 INSERT INTO sos.component_actions
 SELECT target,(ids->>x.component_id::text)::uuid,x.action_key,x.label FROM sos.component_actions x WHERE release_id=source_release;
 INSERT INTO sos.permission_grants SELECT target,role_code,permission_key,scope FROM sos.permission_grants WHERE release_id=source_release;
 INSERT INTO sos.erp_resources(release_id,kind,title,fields,submit_roles,manage_roles,review_roles,
   financial,approval_count,approval_threshold,allow_self_approval_without_partners,no_partner_approval_count)
 SELECT target,kind,title,fields,submit_roles,manage_roles,
   CASE WHEN kind='drawings' THEN ARRAY(SELECT DISTINCT v FROM unnest(review_roles||ARRAY['PARTNER']) v ORDER BY v) ELSE review_roles END,
   financial,approval_count,approval_threshold,allow_self_approval_without_partners,no_partner_approval_count
 FROM sos.erp_resources WHERE release_id=source_release;
 INSERT INTO sos.project_setup_definitions(release_id,definition)
 SELECT target,definition FROM sos.project_setup_definitions WHERE release_id=source_release;
 UPDATE sos.sector_releases SET state='PUBLISHED',published_at=now() WHERE id=target;
 RETURN target;
END $body$;
REVOKE ALL ON FUNCTION sos.clone_partner_drawing_release(uuid) FROM PUBLIC;
