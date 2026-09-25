-- =====================================================
-- Migration 021: Profile Completion Flag
-- Step 6.5 — Database Design
-- =====================================================
-- Adds profile_completed to the users table so that profile
-- completion is a backend-authoritative business/security state.
--
-- Default: false (new/incomplete profile).
-- Existing users are preserved with false (requires setup).
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.profile_completed IS 'Whether the user has completed profile setup. Authoritative source for profile state; cc_profile is UI cache only.';