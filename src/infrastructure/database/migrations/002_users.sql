-- =====================================================
-- Migration 002: Users
-- Step 6.5 — Database Design
-- =====================================================
-- Depends on departments (department_id FK).
-- No self-reference (users.created_by) — audit created_by is NOT
-- a required field per validated blueprint for users.
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'PARENT')),
    department_id UUID,
    password_hash VARCHAR(255), -- Future auth boundary; no plaintext passwords allowed
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    last_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_users_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT
);

-- Index on (department_id, role) — supports queries by department+role
-- (email already indexed by UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_users_department_role ON users(department_id, role);

COMMENT ON TABLE users IS 'System users (PRINCIPAL, HOD, FACULTY, STUDENT, etc.)';
COMMENT ON COLUMN users.id IS 'UUIDv7 primary key, generated at application boundary';
COMMENT ON COLUMN users.role IS 'UPPER_SNAKE_CASE role per rolesandpermissions.js';
COMMENT ON COLUMN users.password_hash IS 'Future auth boundary. NEVER store plaintext passwords.';
COMMENT ON COLUMN users.status IS 'UPPER_SNAKE_CASE status: ACTIVE or INACTIVE';