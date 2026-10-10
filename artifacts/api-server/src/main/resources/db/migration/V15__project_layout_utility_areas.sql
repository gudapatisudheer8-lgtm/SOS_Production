-- Optional capabilities are catalog configuration; published sector definitions
-- and firm release assignments remain immutable and unchanged.
INSERT INTO sos.business_masters(group_code,value_code,label,position,metadata)
VALUES ('project_optional_settings','open-plotting','Optional plotting settings',0,
'{"fields":[{
  "key":"layoutAmenities","label":"Layout Utility Areas","kind":"rows",
  "required":false,"maxRows":100,
  "fields":[
    {"key":"id","label":"Area identifier","kind":"text","required":true,"maxLength":128},
    {"key":"name","label":"Space name","kind":"text","required":true,"maxLength":256},
    {"key":"allocatedAreaSqYards","label":"Area (Sq. Yards)","kind":"number","required":true,"min":0.000001,"decimalPlaces":6},
    {"key":"category","label":"Category","kind":"select","required":false,"options":["park","utilities","clubhouse","roads"]}
  ]
}]}'::jsonb)
ON CONFLICT DO NOTHING;
UPDATE sos.master_catalog_revision SET revision=revision+1 WHERE singleton;

CREATE VIEW sos.project_setup_effective_definitions AS
SELECT d.release_id,
  jsonb_set(d.definition,'{settingsFields}',
    COALESCE(d.definition->'settingsFields','[]'::jsonb) ||
    COALESCE((
      SELECT jsonb_agg(f)
      FROM jsonb_array_elements(COALESCE(m.metadata->'fields','[]'::jsonb)) f
      WHERE f->>'required'='false'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(d.definition->'settingsFields') base
        WHERE base->>'key'=f->>'key'
      )
    ),'[]'::jsonb)
  ) AS definition
FROM sos.project_setup_definitions d
JOIN sos.sector_releases r ON r.id=d.release_id
JOIN sos.sectors s ON s.id=r.sector_id
LEFT JOIN sos.business_masters m
  ON m.group_code='project_optional_settings' AND m.value_code=s.code AND m.enabled;
