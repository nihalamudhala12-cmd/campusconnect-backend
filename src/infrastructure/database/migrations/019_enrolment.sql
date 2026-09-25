-- =====================================================
-- Migration 019: Enrolment
-- Step 6.5 — Database Design
-- =====================================================
-- Tracks student enrollment/class assignment by department,
-- semester, and academic year. Used by analytics and
-- attendance tracking.
-- =====================================================

CREATE TABLE IF NOT EXISTS enrolment (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    department_id UUID NOT NULL,
    semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 10),
    academic_year VARCHAR(9) NOT NULL, -- Format: '2026-27'
    attendance VARCHAR(20) DEFAULT 'PRESENT'
        CHECK (attendance IN ('PRESENT', 'ABSENT', 'EXCUSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_enrolment_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_enrolment_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_enrolment_unique
        UNIQUE (user_id, department_id, semester, academic_year)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_enrolment_user ON enrolment(user_id);
CREATE INDEX IF NOT EXISTS idx_enrolment_department ON enrolment(department_id);
CREATE INDEX IF NOT EXISTS idx_enrolment_semester_year ON enrolment(semester, academic_year);

COMMENT ON TABLE enrolment IS 'Student enrollment/class assignment by department, semester, and academic year';
COMMENT ON COLUMN enrolment.user_id IS 'FK to users.id (student)';
COMMENT ON COLUMN enrolment.department_id IS 'FK to departments.id';
COMMENT ON COLUMN enrolment.semester IS 'Academic semester (1-10)';
COMMENT ON COLUMN enrolment.academic_year IS 'Academic year in format YYYY-YY (e.g., 2026-27)';
COMMENT ON COLUMN enrolment.attendance IS 'UPPER_SNAKE_CASE: PRESENT, ABSENT, EXCUSED';
