-- =====================================================
-- Migration 014: Announcements (and Alerts)
-- Step 6.5 — Database Design
-- =====================================================
-- Single entity representing both announcements and alerts (via 'type' field).
-- Workflow uses audience/status, NOT duplicate state.
--
-- AUDIENCE values:
--   DEPARTMENT             -> scoped to a department (department_id required)
--   ALL                    -> institution-wide, approved publication (department_id NULL)
--   PENDING_INSTITUTION_WIDE -> awaiting principal authorization (department_id preserved)
--
-- STATUS values:
--   ACTIVE                 -> currently published/visible
--   INACTIVE               -> hidden
--   PENDING_AUTHORIZATION  -> awaiting principal approval for institution-wide sharing
--
-- No PERSISTENT REJECTED status (no approved requirement for rejection state).
-- No persistent institution_wide_requested boolean.
-- Principal is the sole approver/publisher for institution-wide sharing.
-- =====================================================

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'ANNOUNCEMENT'
        CHECK (type IN ('ANNOUNCEMENT', 'ALERT')),
    created_by UUID NOT NULL,
    department_id UUID,
    audience VARCHAR(30) NOT NULL DEFAULT 'DEPARTMENT'
        CHECK (audience IN ('DEPARTMENT', 'ALL', 'PENDING_INSTITUTION_WIDE')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_AUTHORIZATION')),
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT')),
    publish_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_announcements_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_announcements_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE RESTRICT,
    -- Audience/department consistency:
    CONSTRAINT chk_ann_dept_required
        CHECK (
            (audience = 'DEPARTMENT' AND department_id IS NOT NULL) OR
            (audience = 'ALL' AND department_id IS NULL) OR
            (audience = 'PENDING_INSTITUTION_WIDE')
            -- PENDING_INSTITUTION_WIDE keeps department_id per existing design
        )
);

-- Index for department announcements
CREATE INDEX IF NOT EXISTS idx_announcements_dept_status
    ON announcements(department_id, status, created_at DESC);
-- Index for institution-wide announcements
CREATE INDEX IF NOT EXISTS idx_announcements_audience
    ON announcements(audience, status);
-- Index for creator lookup
CREATE INDEX IF NOT EXISTS idx_announcements_created_by
    ON announcements(created_by);

COMMENT ON TABLE announcements IS 'Announcements and alerts. Workflow via audience + status.';
COMMENT ON COLUMN announcements.type IS 'ANNOUNCEMENT or ALERT (distinguishes purpose)';
COMMENT ON COLUMN announcements.audience IS 'DEPARTMENT, ALL (institution-wide), or PENDING_INSTITUTION_WIDE';
COMMENT ON COLUMN announcements.status IS 'ACTIVE, INACTIVE, or PENDING_AUTHORIZATION';
COMMENT ON COLUMN announcements.department_id IS 'Required for DEPARTMENT audience; NULL for ALL audience';