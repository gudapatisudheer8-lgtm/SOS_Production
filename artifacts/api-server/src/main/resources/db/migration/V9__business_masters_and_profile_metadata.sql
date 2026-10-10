-- Business configuration only: no example accounts, companies or operational records.
CREATE TABLE sos.business_masters (
  group_code varchar(64) NOT NULL,
  value_code varchar(160) NOT NULL,
  label varchar(240) NOT NULL,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_code,value_code)
);
CREATE TABLE sos.master_catalog_revision (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 1
);
INSERT INTO sos.master_catalog_revision(singleton) VALUES (true);
ALTER TABLE sos.firms ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object');
ALTER TABLE sos.project_memberships ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision>0);
ALTER TABLE sos.project_memberships ADD COLUMN display_name varchar(120);

