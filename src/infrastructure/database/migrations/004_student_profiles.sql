-- =====================================================
-- Migration 004: Student Profiles
-- Step 6.5 — Database Design
-- =====================================================
-- One-to-one with users (STUDENT).
-- No department_id here — department is derived from users.department_id.
-- user_id is UNIQUE (one profile per user).
-- =====================================================

CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    roll_number VARCHAR(50),
    admission_number VARCHAR(50),
    semester INTEGER CHECK (semester >= 1 AND semester <= 10),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_student_profile_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE student_profiles IS 'Student profile details. user_id is 1:1 (UNIQUE).';
COMMENT ON COLUMN student_profiles.user_id IS 'FK to users.id. Role validation (STUDENT) is application-level.';
COMMENT ON COLUMN student_profiles.status IS 'UPPER_SNAKE_CASE status: ACTIVE or INACTIVE';
-- Note: No separate INDEX on user_id — UNIQUE constraint already provides index.