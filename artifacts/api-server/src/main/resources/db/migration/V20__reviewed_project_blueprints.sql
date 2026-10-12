-- Separate visual drafts never alter surveyed inventory, bookings or financial journals.
CREATE TABLE sos.project_blueprints (
    project_id uuid PRIMARY KEY REFERENCES sos.projects(id),
    source_attachment_id uuid NOT NULL REFERENCES sos.erp_attachments(id),
    revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
    status text NOT NULL CHECK(status IN ('DRAFT','CONFIRMED')),
    draft jsonb NOT NULL,
    confirmed jsonb,
    confirmed_attachment_id uuid REFERENCES sos.erp_attachments(id),
    reviewed_by uuid REFERENCES sos.identities(id),
    reviewed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid NOT NULL REFERENCES sos.identities(id)
);
