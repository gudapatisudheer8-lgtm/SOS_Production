-- Align the original UI catalog with the persisted project-setup validator.
DELETE FROM sos.business_masters
WHERE group_code='extent_units' AND value_code='Guntas / Cents';
INSERT INTO sos.business_masters(group_code,value_code,label,position,enabled,metadata)
VALUES ('extent_units','Guntas','Guntas',2,true,'{}'),
       ('extent_units','Cents','Cents',3,true,'{}')
ON CONFLICT (group_code,value_code) DO NOTHING;
UPDATE sos.master_catalog_revision SET revision=revision+1 WHERE singleton=true;
