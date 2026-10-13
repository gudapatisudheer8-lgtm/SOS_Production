-- Appointments are non-financial metadata. No existing receipts/configuration are rewritten.
CREATE TABLE sos.plot_registrations (
    inventory_id uuid PRIMARY KEY REFERENCES sos.erp_records(id),
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    revision integer NOT NULL,
    state text NOT NULL CHECK(state IN ('scheduled','cancelled','completed')),
    starts_at timestamptz,
    location text NOT NULL DEFAULT '',
    reminder_minutes jsonb NOT NULL DEFAULT '[1440,60]',
    updated_by uuid NOT NULL REFERENCES sos.identities(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sos.registration_requests (
    project_id uuid NOT NULL REFERENCES sos.projects(id),
    actor_id uuid NOT NULL REFERENCES sos.identities(id),
    request_id uuid NOT NULL,
    input jsonb NOT NULL,
    result jsonb NOT NULL,
    PRIMARY KEY(project_id,actor_id,request_id)
);
CREATE TABLE sos.registration_jobs (
    id uuid PRIMARY KEY,
    inventory_id uuid NOT NULL REFERENCES sos.plot_registrations(inventory_id),
    revision integer NOT NULL,
    lead_minutes integer NOT NULL,
    due_at timestamptz NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','invalidated')),
    UNIQUE(inventory_id,revision,lead_minutes)
);
CREATE INDEX registration_jobs_due ON sos.registration_jobs(due_at) WHERE state='pending';
ALTER TABLE sos.project_notifications ADD COLUMN recipient_id uuid REFERENCES sos.identities(id);
ALTER TABLE sos.project_notifications ADD COLUMN inventory_id uuid REFERENCES sos.erp_records(id);
ALTER TABLE sos.project_notifications ADD COLUMN registration_revision integer;
ALTER TABLE sos.project_notifications ADD COLUMN invalidated boolean NOT NULL DEFAULT false;
CREATE TABLE sos.browser_push_subscriptions (
    id uuid PRIMARY KEY,
    identity_id uuid NOT NULL REFERENCES sos.identities(id),
    firm_id uuid NOT NULL REFERENCES sos.firms(id),
    role_code text NOT NULL CHECK(role_code IN ('ACCOUNTANT','PARTNER')),
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    last_error text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sos.browser_push_deliveries (
    notification_id uuid NOT NULL REFERENCES sos.project_notifications(id),
    subscription_id uuid NOT NULL REFERENCES sos.browser_push_subscriptions(id),
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','failed','invalidated')),
    last_error text NOT NULL DEFAULT '',
    PRIMARY KEY(notification_id,subscription_id)
);
-- Scheduling policy is database-owned and additive, without changing a firm's release.
CREATE TABLE sos.registration_policy (
    singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
    timezone text NOT NULL,
    default_reminder_minutes jsonb NOT NULL,
    max_reminder_minutes integer NOT NULL,
    max_reminders integer NOT NULL,
    max_location_length integer NOT NULL
);
INSERT INTO sos.registration_policy VALUES(true,'Asia/Kolkata','[1440,60]',43200,5,500);
