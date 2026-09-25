-- =====================================================
-- Migration 020: MFA Support
-- Step 6.5 — Database Design
-- =====================================================
-- Adds MFA capability to the users table.
-- mfa_enabled: whether MFA is required for this user
-- mfa_secret: encrypted TOTP secret (NULL when MFA disabled)
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255) NULL DEFAULT NULL;

COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA is required for this user account';
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret for MFA (NULL when disabled). Never store plaintext codes.';
