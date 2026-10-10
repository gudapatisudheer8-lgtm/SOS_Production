-- Display choices retained from the original interface bind to canonical ERP values.
-- Do not change firms' published release assignments or financial records.
UPDATE sos.business_masters
SET metadata = metadata || '{"canonicalValue":"Cash"}'::jsonb
WHERE group_code='expense_payment_modes' AND value_code='Cash / Spot Voucher';

UPDATE sos.business_masters
SET metadata = metadata || '{"canonicalValue":"UPI"}'::jsonb
WHERE group_code='expense_payment_modes' AND value_code='UPI / Online';
