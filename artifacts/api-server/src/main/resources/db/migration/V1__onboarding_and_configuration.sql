-- DRAFT FOUNDATION MIGRATION. Flyway is disabled until the isolated target is
-- verified and the owner explicitly approves writes. No existing data is reset.
-- This file contains no credentials or application users.

CREATE TABLE sos.roles (
    code text PRIMARY KEY CHECK (code IN ('OWNER', 'ACCOUNTANT', 'PARTNER')),
    label text NOT NULL
);
INSERT INTO sos.roles VALUES
    ('OWNER', 'Product owner'), ('ACCOUNTANT', 'Accountant'), ('PARTNER', 'Partner');

CREATE TABLE sos.identities (
    id uuid PRIMARY KEY,
    mobile text NOT NULL UNIQUE CHECK (mobile ~ '^\+[1-9][0-9]{7,14}$'),
    display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
    credential_hash text NOT NULL,
    must_change_credential boolean NOT NULL DEFAULT true,
    temporary_credential_expires_at timestamptz,
    credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sos.owner_memberships (
    identity_id uuid PRIMARY KEY REFERENCES sos.identities(id)
);

CREATE TABLE sos.firms (
    id uuid PRIMARY KEY,
    client_code text NOT NULL UNIQUE CHECK (client_code ~ '^[A-Z0-9-]{3,32}$'),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_by uuid NOT NULL REFERENCES sos.identities(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sos.firm_memberships (
    firm_id uuid NOT NULL REFERENCES sos.firms(id),
    identity_id uuid NOT NULL REFERENCES sos.identities(id),
    role_code text NOT NULL REFERENCES sos.roles(code) CHECK (role_code <> 'OWNER'),
    enabled boolean NOT NULL DEFAULT true,
    PRIMARY KEY (firm_id, identity_id, role_code)
);
CREATE INDEX firm_memberships_identity_idx ON sos.firm_memberships(identity_id, firm_id);

CREATE TABLE sos.sectors (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9-]{1,63}$'),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sos.sector_releases (
    id uuid PRIMARY KEY,
    sector_id uuid NOT NULL REFERENCES sos.sectors(id),
    version integer NOT NULL CHECK (version > 0),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    state text NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT', 'PUBLISHED')),
    label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 120),
    created_by uuid REFERENCES sos.identities(id),
    published_by uuid REFERENCES sos.identities(id),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (sector_id, version),
    UNIQUE (id, sector_id),
    CHECK ((state = 'PUBLISHED') = (published_at IS NOT NULL))
);

CREATE TABLE sos.firm_sector_assignments (
    firm_id uuid NOT NULL REFERENCES sos.firms(id),
    sector_id uuid NOT NULL REFERENCES sos.sectors(id),
    release_id uuid NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    PRIMARY KEY (firm_id, sector_id),
    FOREIGN KEY (release_id, sector_id) REFERENCES sos.sector_releases(id, sector_id)
);

CREATE TABLE sos.projects (
    id uuid PRIMARY KEY,
    firm_id uuid NOT NULL REFERENCES sos.firms(id),
    sector_id uuid NOT NULL,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    location text,
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_by uuid NOT NULL REFERENCES sos.identities(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, firm_id),
    FOREIGN KEY (firm_id, sector_id) REFERENCES sos.firm_sector_assignments(firm_id, sector_id)
);
CREATE INDEX projects_firm_sector_idx ON sos.projects(firm_id, sector_id);

CREATE TABLE sos.project_memberships (
    project_id uuid NOT NULL,
    firm_id uuid NOT NULL,
    identity_id uuid NOT NULL,
    role_code text NOT NULL DEFAULT 'PARTNER' CHECK (role_code = 'PARTNER'),
    enabled boolean NOT NULL DEFAULT true,
    PRIMARY KEY (project_id, identity_id),
    FOREIGN KEY (project_id, firm_id) REFERENCES sos.projects(id, firm_id),
    FOREIGN KEY (firm_id, identity_id, role_code)
        REFERENCES sos.firm_memberships(firm_id, identity_id, role_code)
);
CREATE INDEX project_memberships_identity_idx ON sos.project_memberships(identity_id, firm_id);

CREATE TABLE sos.auth_sessions (
    token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
    identity_id uuid NOT NULL REFERENCES sos.identities(id),
    role_code text NOT NULL REFERENCES sos.roles(code),
    firm_id uuid REFERENCES sos.firms(id),
    credential_version integer NOT NULL CHECK (credential_version > 0),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (role_code <> 'ACCOUNTANT' OR firm_id IS NOT NULL)
);
CREATE INDEX auth_sessions_identity_idx ON sos.auth_sessions(identity_id);
CREATE INDEX auth_sessions_expiry_idx ON sos.auth_sessions(expires_at);

CREATE TABLE sos.signin_limits (
    key_hash text PRIMARY KEY CHECK (length(key_hash) = 64),
    failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
    window_until timestamptz NOT NULL,
    locked_until timestamptz
);

-- Registry keys are data references to trusted implementations, never scripts.
CREATE TABLE sos.component_definitions (
    key text PRIMARY KEY,
    label text NOT NULL,
    props_schema jsonb NOT NULL CHECK (jsonb_typeof(props_schema) = 'object')
);
CREATE TABLE sos.permission_definitions (
    key text PRIMARY KEY,
    label text NOT NULL
);
CREATE TABLE sos.action_definitions (
    key text PRIMARY KEY,
    label text NOT NULL,
    handler_key text NOT NULL,
    permission_key text NOT NULL REFERENCES sos.permission_definitions(key),
    input_schema jsonb NOT NULL CHECK (jsonb_typeof(input_schema) = 'object')
);
CREATE TABLE sos.data_source_definitions (
    key text PRIMARY KEY,
    handler_key text NOT NULL,
    permission_key text NOT NULL REFERENCES sos.permission_definitions(key),
    parameter_schema jsonb NOT NULL CHECK (jsonb_typeof(parameter_schema) = 'object')
);

CREATE TABLE sos.sector_interfaces (
    id uuid PRIMARY KEY,
    release_id uuid NOT NULL REFERENCES sos.sector_releases(id),
    role_code text NOT NULL REFERENCES sos.roles(code) CHECK (role_code <> 'OWNER'),
    title text NOT NULL,
    UNIQUE (release_id, role_code),
    UNIQUE (id, release_id)
);
CREATE TABLE sos.interface_screens (
    id uuid PRIMARY KEY,
    release_id uuid NOT NULL,
    interface_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    UNIQUE (interface_id, key),
    UNIQUE (id, release_id),
    FOREIGN KEY (interface_id, release_id) REFERENCES sos.sector_interfaces(id, release_id)
);
CREATE TABLE sos.screen_components (
    id uuid PRIMARY KEY,
    release_id uuid NOT NULL,
    screen_id uuid NOT NULL,
    component_key text NOT NULL REFERENCES sos.component_definitions(key),
    data_source_key text REFERENCES sos.data_source_definitions(key),
    props jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(props) = 'object'),
    position integer NOT NULL CHECK (position >= 0),
    UNIQUE (id, release_id),
    FOREIGN KEY (screen_id, release_id) REFERENCES sos.interface_screens(id, release_id)
);

CREATE TABLE sos.option_sets (
    id uuid PRIMARY KEY,
    release_id uuid NOT NULL REFERENCES sos.sector_releases(id),
    key text NOT NULL,
    UNIQUE (release_id, key),
    UNIQUE (id, release_id)
);
CREATE TABLE sos.options (
    id uuid PRIMARY KEY,
    release_id uuid NOT NULL,
    option_set_id uuid NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    UNIQUE (option_set_id, value),
    FOREIGN KEY (option_set_id, release_id) REFERENCES sos.option_sets(id, release_id)
);
CREATE TABLE sos.field_definitions (
    id uuid PRIMARY KEY,
    release_id uuid NOT NULL REFERENCES sos.sector_releases(id),
    key text NOT NULL,
    label text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('text', 'number', 'date', 'select', 'boolean')),
    required boolean NOT NULL DEFAULT false,
    option_set_id uuid,
    constraints jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(constraints) = 'object'),
    UNIQUE (release_id, key),
    UNIQUE (id, release_id),
    FOREIGN KEY (option_set_id, release_id) REFERENCES sos.option_sets(id, release_id)
);
CREATE TABLE sos.form_fields (
    release_id uuid NOT NULL,
    component_id uuid NOT NULL,
    field_id uuid NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    PRIMARY KEY (component_id, field_id),
    FOREIGN KEY (component_id, release_id) REFERENCES sos.screen_components(id, release_id),
    FOREIGN KEY (field_id, release_id) REFERENCES sos.field_definitions(id, release_id)
);
CREATE TABLE sos.component_actions (
    release_id uuid NOT NULL,
    component_id uuid NOT NULL,
    action_key text NOT NULL REFERENCES sos.action_definitions(key),
    label text NOT NULL,
    PRIMARY KEY (component_id, action_key),
    FOREIGN KEY (component_id, release_id) REFERENCES sos.screen_components(id, release_id)
);
CREATE TABLE sos.permission_grants (
    release_id uuid NOT NULL REFERENCES sos.sector_releases(id),
    role_code text NOT NULL REFERENCES sos.roles(code) CHECK (role_code <> 'OWNER'),
    permission_key text NOT NULL REFERENCES sos.permission_definitions(key),
    scope text NOT NULL CHECK (scope IN ('FIRM', 'MEMBER_PROJECTS')),
    PRIMARY KEY (release_id, role_code, permission_key),
    CHECK (role_code <> 'PARTNER' OR scope = 'MEMBER_PROJECTS')
);
CREATE TABLE sos.configuration_audit (
    id uuid PRIMARY KEY,
    actor_id uuid NOT NULL REFERENCES sos.identities(id),
    event text NOT NULL,
    firm_id uuid REFERENCES sos.firms(id),
    release_id uuid REFERENCES sos.sector_releases(id),
    event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(event_data) = 'object'),
    CHECK (NOT event_data ?| ARRAY['password', 'pin', 'credential', 'token'])
);

-- Disabling an assignment preserves all its historical projects.
CREATE FUNCTION sos.preserve_project_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.firm_id <> OLD.firm_id OR NEW.sector_id <> OLD.sector_id THEN
        RAISE EXCEPTION 'Project firm and sector are immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER preserve_project_identity BEFORE UPDATE ON sos.projects
    FOR EACH ROW EXECUTE FUNCTION sos.preserve_project_identity();

CREATE FUNCTION sos.protect_published_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.state = 'PUBLISHED' THEN
        RAISE EXCEPTION 'Published releases are immutable; create a new version';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER protect_published_release BEFORE UPDATE OR DELETE ON sos.sector_releases
    FOR EACH ROW EXECUTE FUNCTION sos.protect_published_release();

-- Child configuration cannot be moved out of a published release to evade its lock.
CREATE FUNCTION sos.protect_release_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    old_release uuid;
    new_release uuid;
BEGIN
    IF TG_OP <> 'INSERT' THEN old_release := OLD.release_id; END IF;
    IF TG_OP <> 'DELETE' THEN new_release := NEW.release_id; END IF;
    IF EXISTS (SELECT 1 FROM sos.sector_releases
               WHERE id IN (old_release, new_release) AND state = 'PUBLISHED') THEN
        RAISE EXCEPTION 'Published interface configuration is immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER immutable_interfaces BEFORE INSERT OR UPDATE OR DELETE ON sos.sector_interfaces
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_screens BEFORE INSERT OR UPDATE OR DELETE ON sos.interface_screens
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_components BEFORE INSERT OR UPDATE OR DELETE ON sos.screen_components
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_option_sets BEFORE INSERT OR UPDATE OR DELETE ON sos.option_sets
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_options BEFORE INSERT OR UPDATE OR DELETE ON sos.options
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_fields BEFORE INSERT OR UPDATE OR DELETE ON sos.field_definitions
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_form_fields BEFORE INSERT OR UPDATE OR DELETE ON sos.form_fields
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_actions BEFORE INSERT OR UPDATE OR DELETE ON sos.component_actions
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();
CREATE TRIGGER immutable_permissions BEFORE INSERT OR UPDATE OR DELETE ON sos.permission_grants
    FOR EACH ROW EXECUTE FUNCTION sos.protect_release_configuration();

CREATE FUNCTION sos.require_published_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sos.sector_releases
                   WHERE id = NEW.release_id AND sector_id = NEW.sector_id AND state = 'PUBLISHED') THEN
        RAISE EXCEPTION 'Only a published release can be assigned to a firm';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER require_published_assignment BEFORE INSERT OR UPDATE ON sos.firm_sector_assignments
    FOR EACH ROW EXECUTE FUNCTION sos.require_published_assignment();
