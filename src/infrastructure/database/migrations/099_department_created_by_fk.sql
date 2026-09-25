-- =====================================================
-- Post-Migration: Add departments.created_by FK
-- Step 6.5 — Database Design
-- =====================================================
-- This script is run AFTER both departments and users tables exist.
-- It adds the departments.created_by FK to resolve the
-- initial circular dependency.
-- =====================================================

-- Add created_by column to departments (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'departments' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE departments ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Add FK constraint (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'departments' AND constraint_name = 'fk_departments_created_by'
    ) THEN
        ALTER TABLE departments
        ADD CONSTRAINT fk_departments_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN departments.created_by IS 'FK to users.id. ON DELETE SET NULL. Audit field for who created the department.';