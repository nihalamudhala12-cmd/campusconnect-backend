-- =====================================================
-- Migration 006: Courses
-- Step 6.5 — Database Design
-- =====================================================
-- Belongs to a department.
-- course_code is UNIQUE within department.
-- =====================================================

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) NOT NULL,
    department_id UUID NOT NULL,
    credits INTEGER CHECK (credits >= 0 AND credits <= 20),
    semester INTEGER CHECK (semester >= 1 AND semester <= 10),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_courses_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_courses_department_code UNIQUE (department_id, code)
);

-- Index on department_id (covered by composite UNIQUE constraint above)
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);

COMMENT ON TABLE courses IS 'Courses/subjects offered by a department';
COMMENT ON COLUMN courses.id IS 'UUIDv7 primary key, generated at application boundary';
COMMENT ON COLUMN courses.status IS 'UPPER_SNAKE_CASE status: ACTIVE or INACTIVE';