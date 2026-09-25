-- =====================================================
-- Migration 011: Approvals
-- Step 6.5 — Database Design
-- =====================================================
-- Generic approval workflow for: leave, marks revisions, syllabus updates, etc.
-- NOT used for institution-wide announcement authorization.
--
-- FK semantics:
--   requested_by: NOT NULL, ON DELETE RESTRICT
--   reviewed_by: NULLABLE, ON DELETE SET NULL
-- =====================================================

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL
        CHECK (type IN ('LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER')),
    requested_by UUID NOT NULL,
    department_id UUID,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_approvals_requested_by
        FOREIGN KEY (requested_by) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_approvals_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_approvals_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE SET NULL
);

-- Index on status for pending approvals query
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
-- Index on requested_by for user's requests query
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by ON approvals(requested_by);

COMMENT ON TABLE approvals IS 'Generic approval workflow (leave, marks revisions, etc.)';
COMMENT ON COLUMN approvals.requested_by IS 'NOT NULL FK to users.id. ON DELETE RESTRICT.';
COMMENT ON COLUMN approvals.reviewed_by IS 'NULLABLE FK to users.id. ON DELETE SET NULL.';
COMMENT ON COLUMN approvals.status IS 'UPPER_SNAKE_CASE: PENDING, APPROVED, REJECTED, CANCELLED';
