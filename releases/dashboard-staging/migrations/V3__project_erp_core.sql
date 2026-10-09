-- Additive, SOS-only. Run through the explicit guarded migration command.
CREATE TABLE sos.erp_resources (
    release_id uuid NOT NULL REFERENCES sos.sector_releases(id),
    kind text NOT NULL CHECK (kind ~ '^[a-z][a-z-]+$'),
    title text NOT NULL,
    fields jsonb NOT NULL CHECK (jsonb_typeof(fields)='array'),
    submit_roles text[] NOT NULL DEFAULT ARRAY['ACCOUNTANT'],
    manage_roles text[] NOT NULL DEFAULT ARRAY['ACCOUNTANT'],
    review_roles text[] NOT NULL DEFAULT ARRAY['ACCOUNTANT'],
    financial boolean NOT NULL DEFAULT false,
    approval_count integer NOT NULL DEFAULT 1 CHECK (approval_count BETWEEN 1 AND 10),
    approval_threshold numeric(20,2),
    PRIMARY KEY (release_id,kind)
);
CREATE TRIGGER immutable_erp_resources BEFORE INSERT OR UPDATE OR DELETE ON sos.erp_resources
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();

CREATE TABLE sos.erp_records (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL,
    firm_id uuid NOT NULL,
    kind text NOT NULL,
    data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
    request_data jsonb NOT NULL CHECK (jsonb_typeof(request_data)='object'),
    amount numeric(20,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    partner_id uuid REFERENCES sos.identities(id),
    account_id uuid,
    inventory_id uuid,
    status text NOT NULL CHECK (status IN ('pending','approved','rejected','deleted')),
    revision integer NOT NULL DEFAULT 1,
    created_by uuid NOT NULL REFERENCES sos.identities(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    request_id uuid NOT NULL,
    UNIQUE (id,project_id),
    UNIQUE (project_id,created_by,request_id),
    FOREIGN KEY (project_id,firm_id) REFERENCES sos.projects(id,firm_id),
    FOREIGN KEY (account_id,project_id) REFERENCES sos.erp_records(id,project_id),
    FOREIGN KEY (inventory_id,project_id) REFERENCES sos.erp_records(id,project_id)
);
CREATE INDEX erp_records_project_idx ON sos.erp_records(project_id,kind,status);
CREATE UNIQUE INDEX erp_plot_number_unique ON sos.erp_records(project_id,(data->>'plotNumber'))
    WHERE kind='plots' AND status<>'deleted';
CREATE UNIQUE INDEX erp_unit_number_unique ON sos.erp_records(project_id,(data->>'unitNumber'))
    WHERE kind='units' AND status<>'deleted';
CREATE UNIQUE INDEX erp_partner_profile_unique ON sos.erp_records(project_id,partner_id)
    WHERE kind='partner-profiles' AND status<>'deleted';
CREATE TABLE sos.erp_approvals (
    record_id uuid NOT NULL REFERENCES sos.erp_records(id),
    actor_id uuid NOT NULL REFERENCES sos.identities(id),
    decision text NOT NULL CHECK (decision IN ('approved','rejected')),
    reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(record_id,actor_id)
);
CREATE TABLE sos.erp_postings (
    id uuid PRIMARY KEY,
    record_id uuid NOT NULL REFERENCES sos.erp_records(id),
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    account_id uuid,
    ledger_code text NOT NULL,
    debit numeric(20,2) NOT NULL DEFAULT 0,
    credit numeric(20,2) NOT NULL DEFAULT 0,
    CHECK (debit>=0 AND credit>=0 AND (debit=0 OR credit=0)),
    FOREIGN KEY(account_id,project_id) REFERENCES sos.erp_records(id,project_id),
    UNIQUE(record_id,ledger_code,account_id)
);
CREATE TABLE sos.erp_project_settings (
    project_id uuid PRIMARY KEY REFERENCES sos.projects(id),
    revision integer NOT NULL DEFAULT 1,
    data jsonb NOT NULL DEFAULT '{"equitySplitMode":"fixed","ledgerMode":"internal_syndicate"}'
);
CREATE TABLE sos.erp_audit (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    actor_id uuid NOT NULL REFERENCES sos.identities(id),
    record_id uuid REFERENCES sos.erp_records(id),
    event text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp_audit_project_idx ON sos.erp_audit(project_id,created_at);
-- Financial records are immutable once posted; corrections must not erase history.
CREATE FUNCTION sos.guard_erp_posting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Financial history is append-only';
END $$;
CREATE TRIGGER immutable_postings BEFORE UPDATE OR DELETE ON sos.erp_postings
    FOR EACH ROW EXECUTE FUNCTION sos.guard_erp_posting();

INSERT INTO sos.component_definitions(key,label,props_schema) VALUES
 ('erp-dashboard','Original venture overview','{}'),
 ('erp-resource','Project resource workspace','{}'),
 ('erp-equity','Syndicate equity','{}'),
 ('erp-layout','Plot layout calculation','{}'),
 ('erp-pricing','Apartment pricing matrix','{}'),
 ('erp-statement','Project statement','{}'),
 ('erp-audit','Project audit history','{}'),
 ('erp-settings','Project ledger settings','{}');
INSERT INTO sos.component_definitions(key,label,props_schema) VALUES ('erp-plan','Original project plan builders','{}');
INSERT INTO sos.permission_definitions(key,label) VALUES
 ('erp.read','Read project ERP'),('erp.manage','Manage project ERP'),
 ('erp.submit','Submit own project records'),('erp.review','Approve project records');
INSERT INTO sos.action_definitions(key,label,handler_key,permission_key,input_schema) VALUES
 ('erp.save','Save project record','erp.save','erp.submit','{}'),
 ('erp.bulk-save','Generate project inventory','erp.bulk-save','erp.submit','{}'),
 ('erp.review','Review project record','erp.review','erp.review','{}'),
 ('erp.delete','Remove unposted record','erp.delete','erp.manage','{}'),
 ('erp.settings','Update project settings','erp.settings','erp.manage','{}');
INSERT INTO sos.action_definitions(key,label,handler_key,permission_key,input_schema)
 VALUES('erp.inventory-stage','Update approved sale milestone','erp.inventory-stage','erp.manage','{}');
