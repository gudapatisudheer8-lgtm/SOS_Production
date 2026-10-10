-- Marketing identities and sessions are deliberately independent of firm credentials.
CREATE TABLE sos.marketing_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  data jsonb NOT NULL CHECK(jsonb_typeof(data)='object')
);
INSERT INTO sos.marketing_policy(data) VALUES ('{
  "temporaryPin":"9999","pinLength":6,"invitationHours":168,"sessionHours":12,
  "maxLoginAttempts":5,"lockSeconds":900,"deadlineHours":48,"maxDeadlineHours":168,
  "statusLabels":{"available":"Available","blocked":"Blocked","reserved":"Booked","sold":"Sold"}
}');
CREATE TABLE sos.marketing_agents (
  id uuid PRIMARY KEY, mobile text NOT NULL UNIQUE, name text NOT NULL,
  pin_hash text NOT NULL, must_change_pin boolean NOT NULL DEFAULT true,
  credential_version integer NOT NULL DEFAULT 1, enabled boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sos.marketing_invitations (
  id uuid PRIMARY KEY, agent_id uuid NOT NULL REFERENCES sos.marketing_agents(id),
  project_id uuid NOT NULL REFERENCES sos.projects(id), token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES sos.identities(id), enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL, activated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketing_invitation_project_idx ON sos.marketing_invitations(project_id,agent_id);
CREATE TABLE sos.marketing_sessions (
  token_hash text PRIMARY KEY, invitation_id uuid NOT NULL REFERENCES sos.marketing_invitations(id),
  agent_id uuid NOT NULL REFERENCES sos.marketing_agents(id), credential_version integer NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sos.marketing_proposals (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES sos.projects(id),
  agent_id uuid NOT NULL REFERENCES sos.marketing_agents(id),
  plot_id uuid NOT NULL REFERENCES sos.erp_records(id), request_id uuid NOT NULL,
  data jsonb NOT NULL, status text NOT NULL CHECK(status IN ('pending','accepted_blocked','rejected')),
  reviewed_by uuid REFERENCES sos.identities(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(agent_id,project_id,request_id)
);
CREATE UNIQUE INDEX marketing_one_pending_plot_idx ON sos.marketing_proposals(plot_id) WHERE status='pending';
CREATE INDEX marketing_proposals_project_idx ON sos.marketing_proposals(project_id,created_at);
