-- Presentation choices remain in the database; canonical codes match published ERP forms.
UPDATE sos.business_masters SET metadata=metadata||'{"canonicalValue":"Cash"}'::jsonb
WHERE group_code='cash_investment_modes';
UPDATE sos.business_masters SET metadata=metadata||'{"canonicalValue":"RTGS / NEFT"}'::jsonb
WHERE group_code='bank_investment_modes' AND value_code IN ('Bank Wire (RTGS / NEFT)','IMPS Immediate Transfer');
UPDATE sos.business_masters SET metadata=metadata||'{"canonicalValue":"Cheque"}'::jsonb
WHERE group_code='bank_investment_modes' AND value_code='Bank Cheque / Demand Draft';
UPDATE sos.business_masters SET metadata=metadata||'{"canonicalValue":"UPI"}'::jsonb
WHERE group_code='bank_investment_modes' AND value_code='UPI / QR Transfer (PhonePe / GPay)';
UPDATE sos.business_masters SET metadata=metadata||'{"canonicalValue":"Cash","accountRouting":"selected"}'::jsonb
WHERE group_code='bank_investment_modes' AND value_code='Cash Deposit Directly into Project Bank Account';
UPDATE sos.business_masters
SET metadata=jsonb_set(
  metadata||'{"cashCanonicalModesByField":{"payoutMode":"Field Vault Cash"}}'::jsonb,
  '{cashPaymentModes}',(metadata->'cashPaymentModes')||'["Field Vault Cash"]'::jsonb)
WHERE group_code='project_account_defaults' AND value_code='standard';
