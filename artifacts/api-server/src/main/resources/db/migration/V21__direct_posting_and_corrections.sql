-- No historic pending request is posted by this migration.
-- Historical approvals remain audit evidence only; new saves never require votes.
ALTER TABLE sos.erp_records DROP CONSTRAINT erp_records_status_check;
ALTER TABLE sos.erp_records ADD CONSTRAINT erp_records_status_check
    CHECK(status IN ('pending','approved','rejected','deleted','referred_back','superseded'));
ALTER TABLE sos.erp_records ADD COLUMN correction_of uuid;
ALTER TABLE sos.erp_records ADD COLUMN reversal_of uuid;
ALTER TABLE sos.erp_records ADD COLUMN replacement_id uuid;
ALTER TABLE sos.erp_records ADD COLUMN correction_reason text NOT NULL DEFAULT '';
ALTER TABLE sos.erp_records ADD COLUMN refer_request_id uuid;
ALTER TABLE sos.erp_records ADD COLUMN refer_actor_id uuid REFERENCES sos.identities(id);
ALTER TABLE sos.erp_records ADD COLUMN inventory_before jsonb;
ALTER TABLE sos.erp_records ADD CONSTRAINT correction_same_project FOREIGN KEY(correction_of,project_id) REFERENCES sos.erp_records(id,project_id);
ALTER TABLE sos.erp_records ADD CONSTRAINT reversal_same_project FOREIGN KEY(reversal_of,project_id) REFERENCES sos.erp_records(id,project_id);
ALTER TABLE sos.erp_records ADD CONSTRAINT replacement_same_project FOREIGN KEY(replacement_id,project_id) REFERENCES sos.erp_records(id,project_id);
CREATE UNIQUE INDEX erp_reversal_once ON sos.erp_records(reversal_of) WHERE reversal_of IS NOT NULL;
CREATE UNIQUE INDEX erp_replacement_once ON sos.erp_records(correction_of) WHERE correction_of IS NOT NULL;
CREATE TABLE sos.project_notifications (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    record_id uuid REFERENCES sos.erp_records(id),
    actor_id uuid REFERENCES sos.identities(id),
    marketing_agent_id uuid REFERENCES sos.marketing_agents(id),
    title text NOT NULL,
    message text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (actor_id IS NOT NULL OR marketing_agent_id IS NOT NULL)
);
CREATE INDEX project_notification_recent ON sos.project_notifications(project_id,created_at DESC);
CREATE TABLE sos.project_notification_reads (
    notification_id uuid NOT NULL REFERENCES sos.project_notifications(id),
    identity_id uuid NOT NULL REFERENCES sos.identities(id),
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(notification_id,identity_id)
);
