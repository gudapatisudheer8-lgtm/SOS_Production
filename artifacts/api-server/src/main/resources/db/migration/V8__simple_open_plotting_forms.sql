-- Immutable additive configuration release. No business records or firm assignments are changed.
CREATE TEMP TABLE simple_clone_ids(old_id uuid PRIMARY KEY,new_id uuid NOT NULL);
DO $migration$
DECLARE sector uuid; old_release uuid; new_release uuid; next_version integer;
 definition jsonb; field_list jsonb; section jsonb; sections jsonb := '[]'; partner_fields jsonb; account_fields jsonb;
BEGIN
 SELECT id INTO sector FROM sos.sectors WHERE code='open-plotting';
 IF sector IS NULL THEN RAISE EXCEPTION 'Open plotting sector is not configured'; END IF;
 SELECT r.id INTO old_release FROM sos.sector_releases r JOIN sos.project_setup_definitions d ON d.release_id=r.id
 WHERE r.sector_id=sector AND r.state='PUBLISHED' ORDER BY r.version DESC LIMIT 1;
 IF old_release IS NULL THEN RAISE EXCEPTION 'A published open plotting project workspace is required'; END IF;
 SELECT max(version)+1 INTO next_version FROM sos.sector_releases WHERE sector_id=sector;
 new_release := gen_random_uuid();
 INSERT INTO sos.sector_releases(id,sector_id,version,label,state)
 SELECT new_release,sector,next_version,'Simple open plotting · '||name,'DRAFT' FROM sos.sectors WHERE id=sector;
 INSERT INTO simple_clone_ids
 SELECT id,gen_random_uuid() FROM sos.sector_interfaces WHERE release_id=old_release UNION ALL
 SELECT id,gen_random_uuid() FROM sos.interface_screens WHERE release_id=old_release UNION ALL
 SELECT id,gen_random_uuid() FROM sos.screen_components WHERE release_id=old_release UNION ALL
 SELECT id,gen_random_uuid() FROM sos.option_sets WHERE release_id=old_release UNION ALL
 SELECT id,gen_random_uuid() FROM sos.field_definitions WHERE release_id=old_release;
 INSERT INTO sos.sector_interfaces
 SELECT m.new_id,new_release,x.role_code,x.title FROM sos.sector_interfaces x JOIN simple_clone_ids m ON m.old_id=x.id WHERE x.release_id=old_release;
 INSERT INTO sos.interface_screens
 SELECT m.new_id,new_release,i.new_id,x.key,x.label,x.position FROM sos.interface_screens x JOIN simple_clone_ids m ON m.old_id=x.id JOIN simple_clone_ids i ON i.old_id=x.interface_id WHERE x.release_id=old_release;
 INSERT INTO sos.screen_components
 SELECT m.new_id,new_release,i.new_id,x.component_key,x.data_source_key,x.props,x.position FROM sos.screen_components x JOIN simple_clone_ids m ON m.old_id=x.id JOIN simple_clone_ids i ON i.old_id=x.screen_id WHERE x.release_id=old_release;
 INSERT INTO sos.option_sets
 SELECT m.new_id,new_release,x.key FROM sos.option_sets x JOIN simple_clone_ids m ON m.old_id=x.id WHERE x.release_id=old_release;
 INSERT INTO sos.options
 SELECT gen_random_uuid(),new_release,m.new_id,x.value,x.label,x.position FROM sos.options x JOIN simple_clone_ids m ON m.old_id=x.option_set_id WHERE x.release_id=old_release;
 INSERT INTO sos.field_definitions
 SELECT m.new_id,new_release,x.key,x.label,x.kind,x.required,o.new_id,x.constraints FROM sos.field_definitions x JOIN simple_clone_ids m ON m.old_id=x.id LEFT JOIN simple_clone_ids o ON o.old_id=x.option_set_id WHERE x.release_id=old_release;
 INSERT INTO sos.form_fields
 SELECT new_release,c.new_id,f.new_id,x.position FROM sos.form_fields x JOIN simple_clone_ids c ON c.old_id=x.component_id JOIN simple_clone_ids f ON f.old_id=x.field_id WHERE x.release_id=old_release;
 INSERT INTO sos.component_actions
 SELECT new_release,c.new_id,x.action_key,x.label FROM sos.component_actions x JOIN simple_clone_ids c ON c.old_id=x.component_id WHERE x.release_id=old_release;
 INSERT INTO sos.permission_grants SELECT new_release,role_code,permission_key,scope FROM sos.permission_grants WHERE release_id=old_release;
 INSERT INTO sos.erp_resources SELECT new_release,kind,title,fields,submit_roles,manage_roles,review_roles,financial,approval_count,approval_threshold FROM sos.erp_resources WHERE release_id=old_release;

 -- Retain internal fields for compatibility/edit preservation, but do not expose them as extra inputs.
 UPDATE sos.erp_resources r SET fields=(SELECT jsonb_agg(
  CASE f->>'key'
   WHEN 'bankName' THEN (f-'options'-'visibleWhen')||'{"kind":"text","required":true,"maxLength":160}'::jsonb
   WHEN 'accountName' THEN f||'{"label":"Account Holder Name","maxLength":160}'::jsonb
   WHEN 'accountNumber' THEN f||'{"required":true,"maxLength":34,"pattern":"^[0-9]{6,34}$"}'::jsonb
   WHEN 'ifscCode' THEN f||'{"label":"IFSC Code","required":true,"maxLength":11,"uppercase":true,"pattern":"^[A-Z]{4}0[A-Z0-9]{6}$"}'::jsonb
   WHEN 'branchName' THEN f||'{"label":"Branch","maxLength":160}'::jsonb
   WHEN 'accountType' THEN f||'{"ui":"hidden","default":"current_operational"}'::jsonb
   WHEN 'openingBalance' THEN f||'{"ui":"hidden","default":0}'::jsonb
   WHEN 'status' THEN f||'{"ui":"hidden","default":"active"}'::jsonb
   ELSE f||'{"ui":"hidden","required":false}'::jsonb
  END ORDER BY CASE f->>'key' WHEN 'bankName' THEN 1 WHEN 'accountName' THEN 2 WHEN 'accountNumber' THEN 3 WHEN 'ifscCode' THEN 4 WHEN 'branchName' THEN 5 ELSE 6 END)
 FROM jsonb_array_elements(r.fields) f)
 WHERE r.release_id=new_release AND r.kind='accounts';
 UPDATE sos.erp_resources r SET fields=(SELECT jsonb_agg(CASE f->>'key'
  WHEN 'userRole' THEN f||'{"label":"Project Role","default":"investor_partner","optionLabels":{"managing_partner":"Managing Partner","field_partner":"Field Partner","site_supervisor":"Site Supervisor","investor_partner":"Investor Partner"}}'::jsonb
  WHEN 'initialCapital' THEN f||'{"label":"Planned Capital","readOnly":true,"default":0,"unit":"INR"}'::jsonb
  WHEN 'fixedEquityPercent' THEN f||'{"label":"Project Equity","unit":"%","decimalPlaces":2}'::jsonb
  WHEN 'partnerId' THEN f
  ELSE f||'{"ui":"hidden","required":false}'::jsonb END)
 FROM jsonb_array_elements(r.fields) f)
 WHERE r.release_id=new_release AND r.kind='partner-profiles';
 SELECT fields INTO account_fields FROM sos.erp_resources WHERE release_id=new_release AND kind='accounts';
 SELECT '[{"key":"name","label":"Partner Name","kind":"text","required":true,"maxLength":120},{"key":"mobile","label":"Mobile Number","kind":"text","required":true,"maxLength":24}]'::jsonb||jsonb_agg(f)
 INTO partner_fields FROM sos.erp_resources r CROSS JOIN LATERAL jsonb_array_elements(r.fields) f WHERE r.release_id=new_release AND r.kind='partner-profiles' AND f->>'key'<>'partnerId';
 SELECT d.definition INTO definition FROM sos.project_setup_definitions d WHERE d.release_id=old_release;
 FOR section IN SELECT value FROM jsonb_array_elements(definition->'sections') LOOP
  SELECT jsonb_agg(CASE f->>'key'
   WHEN 'developmentStage' THEN f||'{"default":"active_sales","optionLabels":{"planning":"Planning","approvals":"Approvals","active_sales":"Active Sales & Operations","development":"Development","completed":"Completed"}}'::jsonb
   WHEN 'totalEstimatedOutlay' THEN f||'{"decimalPlaces":2}'::jsonb
   WHEN 'notes' THEN f||'{"ui":"advanced"}'::jsonb
   WHEN 'targetCompletionDate' THEN f||'{"ui":"advanced"}'::jsonb
   WHEN 'mandalDistrict' THEN f||'{"ui":"advanced"}'::jsonb
   WHEN 'openSpacePercent' THEN f||'{"ui":"advanced","default":0}'::jsonb
   WHEN 'roadDeductionPercent' THEN f||'{"ui":"advanced","default":0}'::jsonb
   ELSE f END) INTO field_list FROM jsonb_array_elements(section->'fields') f;
  sections := sections||jsonb_build_array(jsonb_set(section,'{fields}',field_list));
 END LOOP;
 definition := jsonb_set(definition,'{sections}',sections);
 definition := jsonb_set(definition,'{partnerFields}',partner_fields);
 definition := jsonb_set(definition,'{accountFields}',account_fields);
 definition := jsonb_set(definition,'{settingsFields}',(SELECT jsonb_agg(f||'{"ui":"hidden"}'::jsonb) FROM jsonb_array_elements(definition->'settingsFields') f));
 definition := jsonb_set(definition,'{inventory,fields}',(SELECT jsonb_agg(CASE f->>'key'
  WHEN 'areaSqYards' THEN f||'{"label":"Area per Plot","unit":"Sq. Yards","min":0.001}'::jsonb
  WHEN 'count' THEN f||'{"label":"Plot Count"}'::jsonb
  WHEN 'startNumber' THEN f||'{"default":1,"ui":"hidden"}'::jsonb
  WHEN 'numberPrefix' THEN f||'{"ui":"hidden"}'::jsonb
  ELSE f END) FROM jsonb_array_elements(definition#>'{inventory,fields}') f));
 definition := definition||'{"presentation":"open-plotting-simple"}'::jsonb;
 definition := jsonb_set(definition,'{rules}',(definition->'rules')||'{
  "accountNumberConfirmation":false,"inventoryNumbering":"sequential","autoAllocateFirstPartner":true,
  "capitalAllocation":{"mode":"equity-linked","budgetField":"totalEstimatedOutlay","capitalField":"initialCapital","equityField":"fixedEquityPercent","totalPercent":100,"currencyScale":2,"limitToBudget":true}
 }'::jsonb);
 definition := jsonb_set(definition,'{labels}',(definition->'labels')||'{"inventoryUnit":"plot","inventory":"Plot Matrix","partners":"Partners & Equity","accounts":"Bank Accounts"}'::jsonb);
 INSERT INTO sos.project_setup_definitions(release_id,definition) VALUES(new_release,definition);
 UPDATE sos.sector_releases SET state='PUBLISHED',published_at=now() WHERE id=new_release;
END $migration$;
DROP TABLE simple_clone_ids;
