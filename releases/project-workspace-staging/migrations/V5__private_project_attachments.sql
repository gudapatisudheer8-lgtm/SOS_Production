-- Private file bytes live outside the web release directory; PostgreSQL stores metadata only.
CREATE TABLE sos.erp_attachments (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    uploaded_by uuid NOT NULL REFERENCES sos.identities(id),
    file_name text NOT NULL,
    content_type text NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp_attachments_project_idx ON sos.erp_attachments(project_id);
