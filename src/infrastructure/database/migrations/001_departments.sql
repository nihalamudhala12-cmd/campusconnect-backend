-- =====================================================
-- Migration 001: Departments
-- Step 6.5 — Database Design
-- =====================================================
-- This is the FIRST table to be created (no FK dependencies).
-- The departments.created_by FK to users.id is added in
-- migration 099_department_created_by_fk.sql AFTER users
-- table is created, to avoid circular FK dependency.
-- =====================================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on code (already covered by UNIQUE constraint above)
-- No additional index needed for status (low cardinality)

COMMENT ON TABLE departments IS 'Departments within the institution';
COMMENT ON COLUMN departments.id IS 'UUIDv7 primary key, generated at application boundary';
COMMENT ON COLUMN departments.status IS 'UPPER_SNAKE_CASE status: ACTIVE or INACTIVE';