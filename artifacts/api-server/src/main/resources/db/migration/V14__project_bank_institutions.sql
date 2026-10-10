-- Bank selectors read this editable catalog rather than a React constant.
INSERT INTO sos.business_masters(group_code,value_code,label,position)
SELECT 'bank_names',name,name,ordinality-1
FROM unnest(ARRAY[
 'State Bank of India','HDFC Bank','ICICI Bank','Axis Bank',
 'Kotak Mahindra Bank','Punjab National Bank','Canara Bank',
 'Union Bank of India','Bank of Baroda','IndusInd Bank','Federal Bank'
]) WITH ORDINALITY AS institutions(name,ordinality)
ON CONFLICT DO NOTHING;
UPDATE sos.master_catalog_revision SET revision=revision+1 WHERE singleton;
