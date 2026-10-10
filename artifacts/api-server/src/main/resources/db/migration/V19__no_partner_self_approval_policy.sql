-- Only a project with no enabled partners can use this exception.
-- Normal projects continue to require an independent reviewer.
ALTER TABLE sos.erp_resources
  ADD COLUMN allow_self_approval_without_partners boolean NOT NULL DEFAULT true,
  ADD COLUMN no_partner_approval_count integer NOT NULL DEFAULT 1 CHECK (no_partner_approval_count > 0);
