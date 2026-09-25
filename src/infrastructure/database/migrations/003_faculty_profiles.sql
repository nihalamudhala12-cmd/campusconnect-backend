-- =====================================================
-- Migration 003: Faculty Profiles
-- Step 6.5 — Database Design
-- =====================================================
-- One-to-one with users (FACULTY or HOD).
-- No department_id here — department is derived from users.department_id.
-- user_id is UNIQUE (one profile per user).
-- =====================================================

CREATE TABLE IF NOT EXISTS faculty_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    employee_id VARCHAR(50),
    designation VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_faculty_profile_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE faculty_profiles IS 'Faculty profile details. user_id is 1:1 (UNIQUE).';
COMMENT ON COLUMN faculty_profiles.user_id IS 'FK to users.id. Role validation (FACULTY/HOD) is application-level.';
COMMENT ON COLUMN faculty_profiles.status IS 'UPPER_SNAKE_CASE status: ACTIVE or INACTIVE';
-- Note: No separate INDEX on user_id — UNIQUE constraint already provides index.