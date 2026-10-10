-- Operational defaults are configuration, not example transactions.
INSERT INTO sos.business_masters(group_code,value_code,label,position,metadata)
VALUES ('project_account_defaults','standard','Project account defaults',0,
 '{"bankAccountType":"current_operational","cashAccountType":"field_petty_cash","cashAccountName":"Cash","cashPaymentModes":["Cash","Cash / Spot Voucher","Direct Cash Deposit"],"cashModeFields":["paymentMode","payoutMode"],"cashCanonicalMode":"Cash"}'::jsonb)
ON CONFLICT DO NOTHING;
UPDATE sos.master_catalog_revision SET revision=revision+1 WHERE singleton;

CREATE TABLE sos.project_cash_accounts (
 project_id uuid PRIMARY KEY REFERENCES sos.projects(id) ON DELETE CASCADE,
 account_record_id uuid NOT NULL UNIQUE REFERENCES sos.erp_records(id)
);

-- Existing real projects also receive an empty cash ledger. Reuse an existing
-- approved cash account rather than duplicate it. No fabricated bank details.
DO $$
DECLARE p record; a uuid; creator uuid; body jsonb; policy jsonb;
BEGIN
 SELECT metadata INTO policy FROM sos.business_masters
 WHERE group_code='project_account_defaults' AND value_code='standard' AND enabled;
 FOR p IN SELECT id,firm_id FROM sos.projects LOOP
  SELECT id INTO a FROM sos.erp_records WHERE project_id=p.id AND kind='accounts'
    AND status='approved' AND data->>'accountType'=policy->>'cashAccountType'
    ORDER BY created_at,id LIMIT 1;
  IF a IS NULL THEN
   SELECT identity_id INTO creator FROM sos.firm_memberships
    WHERE firm_id=p.firm_id AND role_code='ACCOUNTANT' AND enabled LIMIT 1;
   IF creator IS NULL THEN
    SELECT identity_id INTO creator FROM sos.owner_memberships LIMIT 1;
   END IF;
   IF creator IS NULL THEN RAISE EXCEPTION 'Cannot create project cash account without an audit identity'; END IF;
   a=gen_random_uuid();
   body=jsonb_build_object('accountName',policy->>'cashAccountName','accountType',policy->>'cashAccountType',
     'status','active','openingBalance',0);
   INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,amount,status,created_by,request_id)
    VALUES(a,p.id,p.firm_id,'accounts',body,body,0,'approved',creator,gen_random_uuid());
  END IF;
  INSERT INTO sos.project_cash_accounts(project_id,account_record_id) VALUES(p.id,a);
 END LOOP;
END $$;
