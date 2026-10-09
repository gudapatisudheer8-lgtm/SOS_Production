-- New immutable releases. Existing releases and project records are not overwritten.
INSERT INTO sos.sectors(id,code,name)
VALUES(gen_random_uuid(),'liquor-vends','Liquor vends'),(gen_random_uuid(),'custom-infra','Turnkey infrastructure')
ON CONFLICT(code) DO NOTHING;

CREATE FUNCTION pg_temp.erp_fields(spec jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb='[]'; pair record; parts text[]; typepart text; item jsonb;
BEGIN
 FOR pair IN SELECT * FROM jsonb_each_text(spec) LOOP
  parts=string_to_array(pair.value,'|'); typepart=replace(parts[2],'!','');
  item=jsonb_build_object('key',pair.key,'label',parts[1],'kind',split_part(typepart,':',1),
    'required',position('!' IN parts[2])>0);
  IF position('select:' IN typepart)=1 THEN item=item||jsonb_build_object('options',to_jsonb(string_to_array(substr(typepart,8),','))); END IF;
  IF typepart='number' THEN item=item||'{"min":0}'::jsonb; END IF;
  result=result||jsonb_build_array(item);
 END LOOP;
 RETURN result;
END $$;

DO $$
DECLARE sector record; release uuid; old_release uuid; ui uuid; page uuid; component uuid;
  field uuid; option_set uuid; option_item jsonb; fielditem jsonb; screen record; role text; pos int; partner_page bool;
  resource record; project_fields jsonb; core_fields jsonb; field_keys text[];
BEGIN
FOR sector IN SELECT * FROM sos.sectors WHERE code IN ('open-plotting','construction','liquor-vends','custom-infra') LOOP
 release=gen_random_uuid();
 SELECT id INTO old_release FROM sos.sector_releases WHERE sector_id=sector.id AND state='PUBLISHED' ORDER BY version DESC LIMIT 1;
 INSERT INTO sos.sector_releases(id,sector_id,version,label)
 VALUES(release,sector.id,(SELECT coalesce(max(version),0)+1 FROM sos.sector_releases WHERE sector_id=sector.id),'Original dashboard · '||sector.name);
 -- All source resource forms are versioned configuration, not sector branches in Java/UI.
 FOR resource IN SELECT * FROM (VALUES
 ('accounts','Project Bank & Cash Accounts',false,ARRAY['ACCOUNTANT'],ARRAY['ACCOUNTANT'],
  '{"accountName":"Account Name|text!","bankName":"Bank Name|text","accountType":"Account Type|select:rera_escrow,syndicate_capital_pool,current_operational,field_petty_cash,tax_statutory!","accountNumber":"Account Number|text","ifscCode":"IFSC Code|text","branchName":"Branch|text","city":"City|text","openingBalance":"Opening Balance|number!","upiId":"UPI ID|text","status":"Status|select:active,frozen,closed!","authorizedSignatories":"Authorized Signatories|text","notes":"Notes|multiline"}'),
 ('transactions','Ledger Transactions',true,ARRAY['ACCOUNTANT'],ARRAY['ACCOUNTANT'],
  '{"accountId":"Project Account|account!","date":"Transaction Date|date!","type":"Transaction Type|select:credit,debit!","amount":"Amount|number!","description":"Description|text!","referenceNo":"Reference Number|text","category":"Category|select:partner_capital,plot_booking_advance,flat_booking_advance,vendor_payout,contractor_payout,field_imprest,partner_draw,statutory_fee,cash_withdrawal,inter_account_transfer,interest_credit,other!","paymentMode":"Payment Mode|select:Cash,Cheque,RTGS / NEFT,UPI!","partnerId":"Partner|partner","bookingId":"Approved Booking ID|text","paymentRefNumber":"Payment Reference|text","notes":"Notes|multiline"}'),
 ('investments','Individual Investments',true,ARRAY['ACCOUNTANT','PARTNER'],ARRAY['ACCOUNTANT','PARTNER'],
  '{"partnerId":"Partner|partner!","amount":"Investment Amount|number!","accountId":"Project Bank / Cash Account|account!","date":"Investment Date|date!","purpose":"Purpose|text!","paymentMode":"Payment Mode|select:Cash,Cheque,RTGS / NEFT,UPI!","referenceNo":"Reference Number|text","notes":"Notes|multiline","coSignatory":"Co-Signatory|text","witnessName":"Witness Name|text","cashVaultLocation":"Cash Vault Location|text"}'),
 ('expenses','Field Expenses & Approvals',true,ARRAY['ACCOUNTANT','PARTNER'],ARRAY['ACCOUNTANT','PARTNER'],
  '{"partnerId":"Partner|partner!","amount":"Expense Amount|number!","category":"Expense Category|select:Fuel,Labor Wages,Material,Tractor/Machinery,Food & Batta,Government/Fee,Misc!","date":"Expense Date|date!","note":"Expense Description|multiline!","paymentSource":"Payment Source|select:project_bank,individual!","accountId":"Project Bank Account|account","paymentMode":"Payment Mode|select:Cash,Cheque,RTGS / NEFT,UPI!","vendorName":"Vendor Name|text","taxInvoiceNo":"Tax Invoice Number|text","isOfficialTaxEligible":"Tax Invoice Eligible|boolean","receiptAttachmentId":"Receipt Attachment|text","voiceAttachmentId":"Voice Note Attachment|text"}'),
 ('budgets','Project Expense Budgets',false,ARRAY['ACCOUNTANT'],ARRAY['ACCOUNTANT'],
  '{"category":"Budget Category|text!","estimatedBudget":"Estimated Budget|number!","vendorNotes":"Vendor Notes|multiline","officialTaxInvoicedAmount":"Tax-Invoiced Amount|number","isOfficialTaxEligible":"Tax Eligible|boolean"}'),
 ('partner-profiles','Syndicate Partner Equity',false,ARRAY['ACCOUNTANT'],ARRAY['ACCOUNTANT'],
  '{"partnerId":"Project Partner|partner!","roleDescription":"Role in Project|text","fixedEquityPercent":"Fixed Equity %|number!","initialCapital":"Committed Initial Capital|number!","userRole":"Project Role|select:managing_partner,field_partner,site_supervisor,investor_partner!","dailySpendingLimit":"Daily Spending Limit|number","officialDeclaredCapital":"Declared Capital|number"}'),
 ('drawings','Partner Drawing Requests',true,ARRAY['ACCOUNTANT','PARTNER'],ARRAY['ACCOUNTANT'],
  '{"partnerId":"Partner|partner!","amount":"Drawing Amount|number!","accountId":"Source Project Account|account!","payoutMode":"Payout Mode|select:Bank Transfer,Field Vault Cash,Cheque!","date":"Requested Date|date!","destinationAccountDetails":"Destination Account Details|text!","purpose":"Purpose|multiline!"}'),
 ('bookings','Customer Bookings',true,ARRAY['ACCOUNTANT','PARTNER'],ARRAY['ACCOUNTANT'],
  '{"inventoryId":"Plot / Apartment|inventory!","buyerName":"Buyer Name|text!","buyerPhone":"Buyer Phone|text!","advanceReceived":"Advance Received|number!","accountId":"Receiving Project Account|account","paymentMode":"Payment Mode|select:Cash,Cheque,RTGS / NEFT,UPI!","paymentRefNumber":"Payment Reference|text","date":"Booking Date|date!","notes":"Notes|multiline"}'),
 ('documents','Project Plans & Documents',false,ARRAY['ACCOUNTANT'],ARRAY['ACCOUNTANT'],
  '{"title":"Document Title|text!","category":"Document Category|select:master_layout,floor_plan,elevation,structural,statutory_clearance!","attachmentId":"Uploaded Attachment|text!"}')
 ) AS r(kind,title,financial,submit_roles,review_roles,fields) LOOP
  INSERT INTO sos.erp_resources(release_id,kind,title,financial,submit_roles,review_roles,fields,approval_count,approval_threshold)
  VALUES(release,resource.kind,resource.title,resource.financial,resource.submit_roles,resource.review_roles,
    pg_temp.erp_fields(resource.fields::jsonb),CASE WHEN resource.kind='expenses' THEN 2 ELSE 1 END,
    CASE WHEN resource.kind='expenses' THEN 10000 ELSE NULL END);
 END LOOP;
 IF sector.code='open-plotting' THEN
  INSERT INTO sos.erp_resources(release_id,kind,title,fields)
  VALUES(release,'plots','Venture Layout Master Grid',pg_temp.erp_fields('{
   "plotNumber":"Plot Number|text!","areaSqYards":"Area (Sq. Yards)|number!","facing":"Facing|select:East,North,West,South,North-East Corner,South-East Corner!",
   "ratePerSqYard":"Rate per Sq. Yard|number!","status":"Status|select:available,blocked,reserved,sold!",
   "blockName":"Block / Sector|text","dimensions":"Dimensions|text","roadWidthFt":"Road Width (Feet)|number","officialDocValue":"Official Document Value|number","notes":"Notes|multiline"
  }'::jsonb));
 ELSIF sector.code='construction' THEN
  INSERT INTO sos.erp_resources(release_id,kind,title,fields)
  VALUES(release,'units','Construction Unit Matrix',pg_temp.erp_fields('{
   "unitNumber":"Unit Number|text!","floor":"Floor|number!","flatType":"Flat Type|select:1 BHK,2 BHK,2.5 BHK,3 BHK,4 BHK,Duplex Penthouse!",
   "sftArea":"Area (Sq. Ft.)|number!","facing":"Facing|select:East,North,West,South,Corner!",
   "baseRate":"Base Rate / Sq. Ft.|number!","facingPremium":"Facing Premium|number","floorRise":"Floor Rise|number",
   "parkingFee":"Parking Fee|number","amenitiesFee":"Amenities Fee|number","status":"Status|select:available,booked,registered!",
   "currentMilestone":"Current Milestone|select:Token Advance,Plinth Level,1st Slab,Brickwork,Plastering & Electrical,Flooring,Handover",
   "officialDocValue":"Official Document Value|number"
  }'::jsonb));
 ELSIF sector.code='liquor-vends' THEN
  INSERT INTO sos.erp_resources(release_id,kind,title,financial,fields)
  VALUES(release,'settlements','Daily Counter Settlement',true,pg_temp.erp_fields('{
   "date":"Settlement Date|date!","counterName":"Counter Name|text!","openingBottles":"Opening Bottles|number!","receivedBottles":"Received Bottles|number!",
   "closingBottles":"Closing Bottles|number!","avgBottlePrice":"Average Bottle Price|number!","cashCollected":"Cash Collected|number!",
   "upiCollected":"UPI Collected|number!","accountId":"Receiving Account|account!","settledBy":"Counter Operator|text","bankDepositSlipNo":"Bank Deposit Slip|text"
  }'::jsonb)),(release,'stock-draws','Partner Stock Draws',true,pg_temp.erp_fields('{
   "partnerId":"Partner|partner!","date":"Draw Date|date!","stockDetails":"Stock Details|multiline!","bottlesCount":"Bottles Count|number!",
   "retailValuation":"Retail Valuation|number!","purpose":"Purpose|text!"
  }'::jsonb));
 END IF;
 -- Resource bounds are stored with each immutable version.
 UPDATE sos.erp_resources SET fields=(
   SELECT jsonb_agg(CASE WHEN f->>'key'='fixedEquityPercent' THEN f||'{"max":100}'::jsonb ELSE f END)
   FROM jsonb_array_elements(fields) f) WHERE release_id=release;

 FOR role IN SELECT unnest(ARRAY['ACCOUNTANT','PARTNER']) LOOP
  partner_page=role='PARTNER'; ui=gen_random_uuid();
  INSERT INTO sos.sector_interfaces(id,release_id,role_code,title)
  VALUES(ui,release,role,CASE WHEN partner_page THEN 'My Venture Workspace' ELSE 'Accountant Dashboard' END);
  pos=0;
  FOR screen IN SELECT * FROM (VALUES
   ('dashboard','Dashboard','erp-dashboard',NULL::text,false),
   ('partners','Syndicate Partners','erp-equity',NULL::text,false),
   ('open-plotting','Open Plotting','erp-resource','plots',false),
   ('construction','Construction','erp-resource','units',false),
   ('liquor-infra','Liquor / Infrastructure','erp-resource','settlements',false),
   ('accounts','Accounts & Treasury','erp-resource','accounts',false),
   ('expenses','Expenses & Approvals','erp-resource','expenses',false),
   ('project-statement','Project Statement','erp-statement',NULL::text,false),
   ('dashboard','Dashboard','erp-dashboard',NULL::text,true),
   ('investments','Investments','erp-resource','investments',true),
   ('expenses-approvals','Expenses & Approvals','erp-resource','expenses',true),
   ('plots','Plots & Bookings','erp-resource',CASE WHEN sector.code='construction' THEN 'units' ELSE 'plots' END,true),
   ('statements','Statements','erp-statement',NULL::text,true)
  ) AS screens(key,label,widget,resource,is_partner) WHERE is_partner=partner_page LOOP
   IF screen.key='open-plotting' AND sector.code<>'open-plotting' OR screen.key='construction' AND sector.code<>'construction'
     OR screen.key='liquor-infra' AND sector.code NOT IN ('liquor-vends','custom-infra')
     OR screen.key='plots' AND sector.code NOT IN ('open-plotting','construction') THEN CONTINUE; END IF;
   page=gen_random_uuid();
   INSERT INTO sos.interface_screens(id,release_id,interface_id,key,label,position) VALUES(page,release,ui,screen.key,screen.label,pos);
   pos=pos+1;
   INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
   VALUES(gen_random_uuid(),release,page,screen.widget,
     CASE WHEN screen.resource IS NULL THEN '{}'::jsonb
       ELSE jsonb_build_object('resource',CASE WHEN sector.code='custom-infra' AND screen.resource='settlements' THEN 'budgets' ELSE screen.resource END) END,0);
   IF screen.key='open-plotting' THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,position) VALUES(gen_random_uuid(),release,page,'erp-layout',1);
   ELSIF screen.key='construction' THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,position) VALUES(gen_random_uuid(),release,page,'erp-pricing',1);
   END IF;
   IF screen.key IN ('open-plotting','construction','plots') THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
    VALUES(gen_random_uuid(),release,page,'erp-resource','{"resource":"bookings"}',2);
   ELSIF screen.key='accounts' THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
    VALUES(gen_random_uuid(),release,page,'erp-resource','{"resource":"transactions"}',1);
   ELSIF screen.key IN ('expenses','expenses-approvals') AND NOT partner_page THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
    VALUES(gen_random_uuid(),release,page,'erp-resource','{"resource":"budgets"}',1);
   ELSIF screen.key='partners' THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
    VALUES(gen_random_uuid(),release,page,'erp-resource','{"resource":"partner-profiles"}',1),
      (gen_random_uuid(),release,page,'erp-resource','{"resource":"investments"}',2);
    component=gen_random_uuid();
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,position) VALUES(component,release,page,'partner-form',3);
    FOR fielditem IN SELECT value FROM jsonb_array_elements('[{"key":"name","label":"Partner Name","kind":"text","required":true},{"key":"mobile","label":"Partner Mobile (+91)","kind":"text","required":true}]'::jsonb) LOOP
     field=gen_random_uuid();
     INSERT INTO sos.field_definitions(id,release_id,key,label,kind,required,constraints)
     VALUES(field,release,fielditem->>'key',fielditem->>'label','text',true,'{"maxLength":120}');
     INSERT INTO sos.form_fields(release_id,component_id,field_id,position) VALUES(release,component,field,CASE WHEN fielditem->>'key'='name' THEN 0 ELSE 1 END);
    END LOOP;
    INSERT INTO sos.component_actions(release_id,component_id,action_key,label) VALUES(release,component,'partner.add','Add Partner & Create Login');
   ELSIF screen.key='liquor-infra' AND sector.code='liquor-vends' THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
    VALUES(gen_random_uuid(),release,page,'erp-resource','{"resource":"stock-draws"}',1);
   ELSIF screen.key IN ('project-statement','statements') THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,position) VALUES(gen_random_uuid(),release,page,'erp-audit',1);
   END IF;
   IF screen.key='dashboard' AND NOT partner_page THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,position) VALUES(gen_random_uuid(),release,page,'erp-plan',1);
    -- Preserve existing configured project fields, including zero/null behavior.
    component=gen_random_uuid();
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,position) VALUES(component,release,page,'project-form',2);
    project_fields='[{"key":"name","label":"Project Name","kind":"text","required":true,"constraints":{"maxLength":160}},
      {"key":"location","label":"Location","kind":"text","required":false,"constraints":{"maxLength":500}}]'::jsonb;
    IF old_release IS NOT NULL THEN
      SELECT jsonb_agg(jsonb_build_object('key',d.key,'label',d.label,'kind',d.kind,'required',d.required,'constraints',d.constraints,
        'options',coalesce((SELECT jsonb_agg(jsonb_build_object('value',o.value,'label',o.label)) FROM sos.options o WHERE o.option_set_id=d.option_set_id),'[]'::jsonb)))
      INTO project_fields FROM sos.field_definitions d JOIN sos.form_fields f ON f.field_id=d.id
      JOIN sos.screen_components c ON c.id=f.component_id WHERE c.release_id=old_release AND c.component_key='project-form';
    END IF;
    core_fields='[{"key":"details.projectCode","label":"Project Code","kind":"text","required":false,"constraints":{"maxLength":64}},
      {"key":"details.extentValue","label":"Project Extent","kind":"number","required":false,"constraints":{"min":0}},
      {"key":"details.extentUnit","label":"Extent Unit","kind":"text","required":false,"constraints":{"maxLength":40}},
      {"key":"details.roadWidth","label":"Road Width","kind":"number","required":false,"constraints":{"min":0}},
      {"key":"details.openSpacePercent","label":"Open Space %","kind":"number","required":false,"constraints":{"min":0,"max":100}},
      {"key":"details.surveyNumbers","label":"Survey Numbers","kind":"text","required":false,"constraints":{"maxLength":500}},
      {"key":"details.mandalDistrict","label":"Mandal / District","kind":"text","required":false,"constraints":{"maxLength":160}},
      {"key":"details.lpOrReraNumber","label":"LP / RERA Number","kind":"text","required":false,"constraints":{"maxLength":120}},
      {"key":"details.totalEstimatedOutlay","label":"Estimated Project Outlay","kind":"number","required":false,"constraints":{"min":0}},
      {"key":"details.startDate","label":"Start Date","kind":"date","required":false,"constraints":{}},
      {"key":"details.targetCompletionDate","label":"Target Completion","kind":"date","required":false,"constraints":{}}]'::jsonb;
    pos=0; field_keys=ARRAY[]::text[];
    FOR fielditem IN SELECT value FROM jsonb_array_elements(project_fields||core_fields) LOOP
     IF fielditem->>'key'=ANY(field_keys) THEN CONTINUE; END IF;
     field_keys=array_append(field_keys,fielditem->>'key');
     field=gen_random_uuid();
     option_set=NULL;
     IF fielditem->>'kind'='select' THEN
      option_set=gen_random_uuid();
      INSERT INTO sos.option_sets(id,release_id,key) VALUES(option_set,release,fielditem->>'key');
      FOR option_item IN SELECT value FROM jsonb_array_elements(fielditem->'options') LOOP
       INSERT INTO sos.options(id,release_id,option_set_id,value,label,position)
       VALUES(gen_random_uuid(),release,option_set,option_item->>'value',option_item->>'label',0);
      END LOOP;
     END IF;
     INSERT INTO sos.field_definitions(id,release_id,key,label,kind,required,constraints,option_set_id)
     VALUES(field,release,fielditem->>'key',fielditem->>'label',fielditem->>'kind',(fielditem->>'required')::boolean,fielditem->'constraints',option_set);
     INSERT INTO sos.form_fields(release_id,component_id,field_id,position) VALUES(release,component,field,pos); pos=pos+1;
    END LOOP;
    INSERT INTO sos.component_actions(release_id,component_id,action_key,label)
    VALUES(release,component,'project.create','Create Project Venture'),(release,component,'project.update','Save Project Changes');
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
    VALUES(gen_random_uuid(),release,page,'erp-resource','{"resource":"documents"}',3);
   END IF;
   IF screen.key='dashboard' AND partner_page THEN
    INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
    VALUES(gen_random_uuid(),release,page,'erp-resource','{"resource":"drawings"}',1);
   END IF;
  END LOOP;
 END LOOP;
 INSERT INTO sos.permission_grants(release_id,role_code,permission_key,scope)
 SELECT release,'ACCOUNTANT',key,'FIRM' FROM sos.permission_definitions WHERE key IN ('projects.read','projects.write','partners.read','partners.write','erp.read','erp.manage','erp.submit','erp.review');
 INSERT INTO sos.permission_grants(release_id,role_code,permission_key,scope)
 SELECT release,'PARTNER',key,'MEMBER_PROJECTS' FROM sos.permission_definitions WHERE key IN ('projects.read','partners.read','erp.read','erp.submit','erp.review');
 UPDATE sos.sector_releases SET state='PUBLISHED',published_at=now() WHERE id=release;
 -- Existing firms retain old immutable releases until owner explicitly selects the new one.
END LOOP;
END $$;
