-- =====================================================
-- Migration 005: Classes
-- Step 6.5 — Database Design
-- =====================================================
-- Belongs to a department.
-- Note: No created_by audit field per validated blueprint.
-- =====================================================

CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    department_id UUID NOT NULL,
    semester INTEGER CHECK (semester >= 1 AND semester <= 10),
    section VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_classes_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_classes_department_code UNIQUE (department_id, code)
);

-- Index on department_id (covered by composite UNIQUE constraint above)
CREATE INDEX IF NOT EXISTS idx_classes_department ON classes(department_id);

COMMENT ON TABLE classes IS 'Academic classes/sections belonging to departments';
COMMENT ON COLUMN classes.id IS 'UUIDv7 primary key, generated at application boundary';
COMMENT ON COLUMN classes.status IS 'UPPER_SNAKE_CASE status: ACTIVE or INACTIVE';