-- Configuration only: no sample firms, partners, bank accounts, inventory or transactions.
ALTER TABLE sos.projects ADD COLUMN setup_state text NOT NULL DEFAULT 'READY'
    CHECK(setup_state IN ('DRAFT','READY'));
ALTER TABLE sos.projects ADD COLUMN setup_release_id uuid REFERENCES sos.sector_releases(id);
CREATE UNIQUE INDEX projects_code_per_firm ON sos.projects(firm_id,upper(btrim(details->>'projectCode')))
    WHERE nullif(btrim(details->>'projectCode'),'') IS NOT NULL;

CREATE TABLE sos.project_setup_definitions (
    release_id uuid PRIMARY KEY REFERENCES sos.sector_releases(id),
    definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object')
);
CREATE TABLE sos.project_setup_sections (
    project_id uuid PRIMARY KEY REFERENCES sos.projects(id),
    data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sos.project_setup_requests (
    firm_id uuid NOT NULL REFERENCES sos.firms(id),
    actor_id uuid NOT NULL REFERENCES sos.identities(id),
    request_id uuid NOT NULL,
    action text NOT NULL,
    input jsonb NOT NULL,
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    result jsonb NOT NULL,
    PRIMARY KEY(firm_id,actor_id,request_id)
);
CREATE TABLE sos.erp_inventory_reservations (
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    inventory_id uuid NOT NULL,
    booking_id uuid PRIMARY KEY,
    state text NOT NULL CHECK(state IN ('active','cleared','released')),
    FOREIGN KEY(inventory_id,project_id) REFERENCES sos.erp_records(id,project_id),
    FOREIGN KEY(booking_id,project_id) REFERENCES sos.erp_records(id,project_id)
);
CREATE UNIQUE INDEX one_active_inventory_reservation ON sos.erp_inventory_reservations(inventory_id) WHERE state='active';

-- Clone the latest interfaces into NEW releases. Do not edit immutable releases
-- or switch any customer's assignment as a side effect of a migration.
CREATE TEMP TABLE setup_clone_ids(old_id uuid PRIMARY KEY,new_id uuid NOT NULL) ON COMMIT DROP;
DO $$
DECLARE s record; old_release uuid; new_release uuid;
BEGIN
FOR s IN SELECT * FROM sos.sectors LOOP
 SELECT sr.id INTO old_release FROM sos.sector_releases sr
 WHERE sr.sector_id=s.id AND sr.state='PUBLISHED'
 AND EXISTS(SELECT 1 FROM sos.erp_resources e WHERE e.release_id=sr.id AND e.kind='accounts')
 ORDER BY sr.version DESC LIMIT 1;
 IF old_release IS NULL THEN CONTINUE; END IF;
 new_release=gen_random_uuid();
 INSERT INTO sos.sector_releases(id,sector_id,version,label)
 SELECT new_release,s.id,max(version)+1,'Project workspace · '||s.name FROM sos.sector_releases WHERE sector_id=s.id;
 DELETE FROM setup_clone_ids;
 INSERT INTO setup_clone_ids SELECT id,gen_random_uuid() FROM sos.sector_interfaces WHERE release_id=old_release
 UNION ALL SELECT id,gen_random_uuid() FROM sos.interface_screens WHERE release_id=old_release
 UNION ALL SELECT id,gen_random_uuid() FROM sos.screen_components WHERE release_id=old_release
 UNION ALL SELECT id,gen_random_uuid() FROM sos.option_sets WHERE release_id=old_release
 UNION ALL SELECT id,gen_random_uuid() FROM sos.field_definitions WHERE release_id=old_release;
 INSERT INTO sos.sector_interfaces SELECT m.new_id,new_release,x.role_code,x.title
 FROM sos.sector_interfaces x JOIN setup_clone_ids m ON m.old_id=x.id WHERE x.release_id=old_release;
 INSERT INTO sos.interface_screens SELECT m.new_id,new_release,i.new_id,x.key,x.label,x.position
 FROM sos.interface_screens x JOIN setup_clone_ids m ON m.old_id=x.id JOIN setup_clone_ids i ON i.old_id=x.interface_id WHERE x.release_id=old_release;
 INSERT INTO sos.screen_components SELECT m.new_id,new_release,i.new_id,x.component_key,x.data_source_key,x.props,x.position
 FROM sos.screen_components x JOIN setup_clone_ids m ON m.old_id=x.id JOIN setup_clone_ids i ON i.old_id=x.screen_id WHERE x.release_id=old_release;
 INSERT INTO sos.option_sets SELECT m.new_id,new_release,x.key
 FROM sos.option_sets x JOIN setup_clone_ids m ON m.old_id=x.id WHERE x.release_id=old_release;
 INSERT INTO sos.options SELECT gen_random_uuid(),new_release,m.new_id,x.value,x.label,x.position
 FROM sos.options x JOIN setup_clone_ids m ON m.old_id=x.option_set_id WHERE x.release_id=old_release;
 INSERT INTO sos.field_definitions SELECT m.new_id,new_release,x.key,x.label,x.kind,x.required,o.new_id,x.constraints
 FROM sos.field_definitions x JOIN setup_clone_ids m ON m.old_id=x.id LEFT JOIN setup_clone_ids o ON o.old_id=x.option_set_id WHERE x.release_id=old_release;
 INSERT INTO sos.form_fields SELECT new_release,c.new_id,f.new_id,x.position
 FROM sos.form_fields x JOIN setup_clone_ids c ON c.old_id=x.component_id JOIN setup_clone_ids f ON f.old_id=x.field_id WHERE x.release_id=old_release;
 INSERT INTO sos.component_actions SELECT new_release,c.new_id,x.action_key,x.label
 FROM sos.component_actions x JOIN setup_clone_ids c ON c.old_id=x.component_id WHERE x.release_id=old_release;
 INSERT INTO sos.permission_grants SELECT new_release,role_code,permission_key,scope FROM sos.permission_grants WHERE release_id=old_release;
 INSERT INTO sos.erp_resources SELECT new_release,kind,title,fields,submit_roles,manage_roles,review_roles,financial,approval_count,approval_threshold
 FROM sos.erp_resources WHERE release_id=old_release;
 -- Extend choices and data fields only on these unpublished releases.
 UPDATE sos.erp_resources SET fields=(SELECT jsonb_agg(CASE WHEN f->>'key'='facing'
  THEN jsonb_set(f,'{options}',(f->'options')||'["Commercial"]'::jsonb) ELSE f END)
  FROM jsonb_array_elements(fields) f) WHERE release_id=new_release AND kind='plots';
 UPDATE sos.erp_resources SET fields=fields||'[
  {"key":"ratePerSqYard","label":"Agreed Rate / Sq. Yard","kind":"number","required":false,"min":0},
  {"key":"bookingStatus","label":"Booking Status","kind":"select","required":false,"options":["reserved","registered"]},
  {"key":"paymentMilestone","label":"Agreement / Payment Stage","kind":"select","required":false,"options":["Token Advance","Agreement Signed","Registration","Full Payment"]},
  {"key":"buyerRegistrationId","label":"Buyer Registration Identifier (optional; encrypted storage required)","kind":"text","required":false},
  {"key":"terms","label":"Agreement Terms / Field Notes","kind":"multiline","required":false}
 ]'::jsonb WHERE release_id=new_release AND kind='bookings';
 UPDATE sos.erp_resources SET review_roles=ARRAY['ACCOUNTANT','PARTNER'] WHERE release_id=new_release AND kind='bookings';
 UPDATE sos.erp_resources SET fields=fields||'[
  {"key":"referenceNo","label":"Payment Reference","kind":"text","required":false},
  {"key":"voucherNo","label":"Bill / Voucher Number","kind":"text","required":false},
  {"key":"approvalWorkflow","label":"Approval Workflow","kind":"select","required":false,"options":["independent_review"]}
 ]'::jsonb WHERE release_id=new_release AND kind='expenses';
 UPDATE sos.erp_resources SET fields=(SELECT jsonb_agg(CASE
  WHEN f->>'key'='accountId' THEN f||'{"visibleWhen":{"field":"paymentSource","values":["project_bank"]}}'::jsonb
  ELSE f END) FROM jsonb_array_elements(fields) f) WHERE release_id=new_release AND kind='expenses';
 INSERT INTO sos.erp_resources(release_id,kind,title,fields,submit_roles,manage_roles,review_roles,financial,approval_count,approval_threshold)
 VALUES(new_release,'reimbursements','Individual Expense Reimbursements','[
  {"key":"expenseId","label":"Approved Individual Expense","kind":"text","required":true},
  {"key":"accountId","label":"Paying Project Account","kind":"account","required":true},
  {"key":"amount","label":"Reimbursement Amount","kind":"number","required":true,"min":0.01},
  {"key":"date","label":"Date","kind":"date","required":true},
  {"key":"paymentMode","label":"Payment Mode","kind":"select","required":true,"options":["UPI","NEFT/RTGS","Cheque","Cash"]},
  {"key":"referenceNo","label":"Payment Reference","kind":"text","required":false},
  {"key":"notes","label":"Narration","kind":"multiline","required":false}
 ]'::jsonb,ARRAY['ACCOUNTANT','PARTNER'],ARRAY['ACCOUNTANT'],ARRAY['ACCOUNTANT','PARTNER'],true,1,NULL);
 UPDATE sos.erp_resources SET fields=(SELECT jsonb_agg(CASE WHEN f->>'key'='bankName'
  THEN f||'{"kind":"select","options":["State Bank of India","HDFC Bank","ICICI Bank","Axis Bank","Bank of Baroda","Canara Bank","Union Bank of India","Other"]}'::jsonb
  ELSE f END) FROM jsonb_array_elements(fields) f)||'[
   {"key":"otherBankName","label":"Other Bank / Institution","kind":"text","required":true,"visibleWhen":{"field":"bankName","values":["Other"]}},
   {"key":"isPrimary","label":"Primary Receipt Account","kind":"boolean","required":false,"default":false}
   ,{"key":"openingBalanceDate","label":"Opening Balance Effective Date","kind":"date","required":true}
  ]'::jsonb WHERE release_id=new_release AND kind='accounts';
END LOOP;
END $$;

-- Preserve original configured resource fields. The setup definition is separate from ERP money handlers.
DO $$
DECLARE r record; common jsonb; sector_fields jsonb; inventory jsonb; accounts jsonb; partner_fields jsonb;
BEGIN
common='[
 {"key":"name","label":"Project / Venture Name","kind":"text","required":true,"maxLength":160},
 {"key":"projectCode","label":"Project Code / Tag","kind":"text","required":true,"maxLength":64},
 {"key":"developmentStage","label":"Development Stage","kind":"select","required":true,"options":["planning","approvals","active_sales","development","completed"]},
 {"key":"startDate","label":"Launch / Start Date","kind":"date","required":true},
 {"key":"targetCompletionDate","label":"Target Completion Date","kind":"date","required":false},
 {"key":"notes","label":"Project Notes","kind":"multiline","required":false,"maxLength":4000}
]'::jsonb;
FOR r IN SELECT sr.id,s.code FROM sos.sector_releases sr JOIN sos.sectors s ON s.id=sr.sector_id
 WHERE sr.state='DRAFT' AND sr.label LIKE 'Project workspace · %' LOOP
 sector_fields='[
 {"key":"location","label":"Project Location / Corridor","kind":"text","required":true,"maxLength":500},
 {"key":"mandalDistrict","label":"Mandal / District","kind":"text","required":false,"maxLength":160},
 {"key":"surveyNumbers","label":"Revenue Survey Numbers","kind":"text","required":false,"maxLength":500},
 {"key":"approvalAuthority","label":"Approval / Contracting Authority","kind":"select","required":false,"options":["CRDA","DTCP","HMDA","AP-RERA","TG-RERA","Municipal","Gram Panchayat","Other"]},
 {"key":"lpOrReraNumber","label":"Permit / LP / RERA / Work Order Reference","kind":"text","required":false,"maxLength":120},
 {"key":"totalEstimatedOutlay","label":"Total Estimated Project Cost","kind":"number","required":true,"min":0,"unit":"INR"}
 ]'::jsonb;
 inventory=NULL;
 IF r.code='open-plotting' THEN
  sector_fields=sector_fields||'[
  {"key":"extentValue","label":"Total Land Extent","kind":"number","required":true,"min":0},
  {"key":"extentUnit","label":"Extent Unit","kind":"select","required":true,"options":["Acres","Sq. Yards","Guntas","Cents"]},
  {"key":"roadWidth","label":"Approach Road Width","kind":"select","required":true,"options":["20","30","40","60"],"unit":"feet"},
  {"key":"openSpacePercent","label":"Open Space Deduction","kind":"number","required":false,"min":0,"max":100,"unit":"percent"},
  {"key":"roadDeductionPercent","label":"Road Deduction","kind":"number","required":false,"min":0,"max":100,"unit":"percent"},
  {"key":"floorRatePerSqYard","label":"Protected Floor Rate","kind":"number","required":true,"min":0,"unit":"INR / square yard"}
  ]'::jsonb;
  inventory='{"kind":"plots","rateField":"floorRatePerSqYard","maxRows":2000,
   "mappings":{"count":"count","area":"areaSqYards","number":"plotNumber","facing":"facing","rate":"ratePerSqYard"},
   "fields":[
    {"key":"count","label":"Number of Plots","kind":"number","required":true,"integer":true,"min":1,"max":2000},
    {"key":"areaSqYards","label":"Area per Plot","kind":"number","required":true,"min":0.01,"unit":"square yards"},
    {"key":"facing","label":"Facing / Group","kind":"select","required":true,"options":["East","North","West","South","North-East Corner","South-East Corner","Commercial"]},
    {"key":"numberPrefix","label":"Plot Number Prefix","kind":"text","required":false,"maxLength":32},
    {"key":"startNumber","label":"First Plot Number","kind":"number","required":true,"integer":true,"min":1},
    {"key":"ratePerSqYard","label":"Selling Rate","kind":"number","required":true,"min":0,"unit":"INR / square yard"},
    {"key":"blockName","label":"Block / Sector","kind":"text","required":false},
    {"key":"dimensions","label":"Actual Plot Dimensions","kind":"text","required":false},
    {"key":"roadWidthFt","label":"Road Approach","kind":"number","required":false,"min":0,"unit":"feet"}
   ]}'::jsonb;
 ELSIF r.code='construction' THEN
  sector_fields=sector_fields||'[
   {"key":"baseSqFtRate","label":"Base Selling Rate","kind":"number","required":true,"min":0,"unit":"INR / square foot"},
   {"key":"commonAreaPercent","label":"Common Area Allowance","kind":"number","required":false,"min":0,"max":100,"unit":"percent"}
  ]'::jsonb;
  inventory='{"kind":"units","rateField":"baseSqFtRate","maxRows":2000,
   "mappings":{"count":"count","area":"sftArea","number":"unitNumber","facing":"facing","rate":"baseRate"},
   "fields":[
    {"key":"count","label":"Number of Units","kind":"number","required":true,"integer":true,"min":1,"max":2000},
    {"key":"floor","label":"Floor","kind":"number","required":true,"integer":true,"min":0},
    {"key":"flatType","label":"Unit Type","kind":"select","required":true,"options":["1 BHK","2 BHK","2.5 BHK","3 BHK","4 BHK","Duplex Penthouse"]},
    {"key":"sftArea","label":"Area per Unit","kind":"number","required":true,"min":0.01,"unit":"square feet"},
    {"key":"facing","label":"Facing","kind":"select","required":true,"options":["East","North","West","South","Corner"]},
    {"key":"numberPrefix","label":"Unit Number Prefix","kind":"text","required":false,"maxLength":32},
    {"key":"startNumber","label":"First Unit Number","kind":"number","required":true,"integer":true,"min":1},
    {"key":"baseRate","label":"Selling Rate","kind":"number","required":true,"min":0,"unit":"INR / square foot"}
   ]}'::jsonb;
 ELSIF r.code='liquor-vends' THEN
  sector_fields=sector_fields||'[
   {"key":"licenseNumber","label":"Excise License Number","kind":"text","required":true,"maxLength":120},
   {"key":"countersCount","label":"Counter Count","kind":"number","required":true,"integer":true,"min":1},
   {"key":"dailySalesTarget","label":"Daily Sales Target per Counter","kind":"number","required":false,"min":0,"unit":"INR"},
   {"key":"securityDeposit","label":"Security Deposit / BG","kind":"number","required":false,"min":0,"unit":"INR"}
  ]'::jsonb;
 ELSIF r.code='custom-infra' THEN
  sector_fields=sector_fields||'[
   {"key":"contractNumber","label":"Tender / Contract Number","kind":"text","required":true,"maxLength":120},
   {"key":"contractType","label":"Contract Model","kind":"select","required":true,"options":["EPC","Item Rate","Lump Sum","Cost Plus"]},
   {"key":"retentionPercent","label":"Retention / BG","kind":"number","required":false,"min":0,"max":100,"unit":"percent"}
  ]'::jsonb;
 END IF;
 UPDATE sos.erp_resources SET fields=(SELECT jsonb_agg(CASE
  WHEN f->>'key'='openingBalance' THEN f||'{"default":0}'::jsonb
  WHEN f->>'key'='status' THEN f||'{"default":"active"}'::jsonb ELSE f END)
  FROM jsonb_array_elements(fields) f) WHERE release_id=r.id AND kind='accounts';
 SELECT fields INTO accounts FROM sos.erp_resources WHERE release_id=r.id AND kind='accounts';
 IF inventory IS NOT NULL THEN
  -- Use the actual ERP kinds/options for shared row fields; never present a
  -- setup choice that its resource handler cannot save.
  inventory=jsonb_set(inventory,'{fields}',(SELECT jsonb_agg(coalesce(f,g))
   FROM jsonb_array_elements(inventory->'fields') g
   LEFT JOIN LATERAL (SELECT x AS f FROM sos.erp_resources e,jsonb_array_elements(e.fields) x
     WHERE e.release_id=r.id AND e.kind=inventory->>'kind' AND x->>'key'=g->>'key') original ON true));
 END IF;
 SELECT '[{"key":"name","label":"Partner Name","kind":"text","required":true,"maxLength":120},
 {"key":"mobile","label":"Mobile Number","kind":"text","required":true,"maxLength":24}]'::jsonb ||
 coalesce(jsonb_agg(f) FILTER(WHERE f->>'key'<>'partnerId'),'[]'::jsonb) INTO partner_fields
 FROM sos.erp_resources e, jsonb_array_elements(e.fields) f WHERE e.release_id=r.id AND e.kind='partner-profiles';
 INSERT INTO sos.project_setup_definitions(release_id,definition) VALUES(r.id,
 jsonb_build_object('title','Add New Syndicate Project / Venture',
 'sections',jsonb_build_array(jsonb_build_object('key','identity','title','Project Identity & Sector','fields',common),
   jsonb_build_object('key','details','title','Location, Approvals & Budget','fields',sector_fields)),
 'inventory',inventory,'partnerFields',partner_fields,'accountFields',accounts,
 'settingsFields','[
  {"key":"equitySplitMode","label":"Equity Allocation Mode","kind":"select","required":true,"default":"fixed","options":["fixed","proportional"]},
  {"key":"autoGenerateInventory","label":"Generate Inventory from Physical Plan","kind":"boolean","required":true,"default":true}
 ]'::jsonb,
 'rules','{"maxPartners":100,"maxAccounts":100,"fixedEquityTotal":100,"accountNumberConfirmation":true,
   "budgetField":"totalEstimatedOutlay",
   "unitConversions":{"Acres":4840,"Sq. Yards":1,"Guntas":121,"Cents":48.4},
   "inventoryInitialStatus":{"plots":"available","units":"available"},
   "layout":{"unitConversions":{"Acres":4840,"Sq. Yards":1,"Guntas":121,"Cents":48.4},
    "roadLossPercentByWidth":{"20":25,"30":30,"40":35,"60":40},
    "roadWidthOptions":[20,30,40,60],"openSpaceLimit":100},
   "pricing":{"fields":[
    {"key":"eastPremium","label":"East Facing Premium","kind":"number","required":false,"min":0},
    {"key":"northPremium","label":"North Facing Premium","kind":"number","required":false,"min":0},
    {"key":"cornerPremium","label":"Corner Premium","kind":"number","required":false,"min":0},
    {"key":"floorRisePerSqFt","label":"Floor Rise Rate","kind":"number","required":false,"min":0},
    {"key":"parkingFee","label":"Parking Fee","kind":"number","required":false,"min":0},
    {"key":"amenitiesFee","label":"Amenities Fee","kind":"number","required":false,"min":0}
   ]},
   "milestones":[{"name":"Booking","percent":10},{"name":"Foundation","percent":20},{"name":"Slab","percent":20},{"name":"Brickwork","percent":20},{"name":"Finishing","percent":20},{"name":"Handover","percent":10}]}'::jsonb,
 'workflow','{"quickTokens":[50000,100000,200000,500000],"allowSelfApproval":false}'::jsonb,
 'labels','{"addProject":"Add Project","saveDraft":"Save Draft","finalize":"Create Project & Load Data",
 "plan":"Physical Plan & Inventory","documents":"Blueprints & Documents","partners":"Partners & Equity",
 "accounts":"Project Accounts & Banking","review":"Review","cancel":"Cancel"}'::jsonb));
END LOOP;
END $$;
UPDATE sos.sector_releases SET state='PUBLISHED',published_at=now()
 WHERE state='DRAFT' AND label LIKE 'Project workspace · %';
CREATE TRIGGER immutable_setup_definitions BEFORE INSERT OR UPDATE OR DELETE ON sos.project_setup_definitions
 FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
