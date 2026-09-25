-- =====================================================
-- Migration 015: Notifications
-- Step 6.5 — Database Design
-- =====================================================
-- User-targeted notifications.
-- Optional link to announcements (ON DELETE SET NULL for soft link).
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL
        CHECK (type IN (
            'APPROVAL_REQUEST', 'APPROVAL_DECISION',
            'ATTENDANCE_MARKED', 'RESULTS_PUBLISHED',
            'ANNOUNCEMENT_PUBLISHED', 'MESSAGE_RECEIVED',
            'TIMETABLE_UPDATE', 'SYSTEM'
        )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_announcement_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_notifications_announcement
        FOREIGN KEY (related_announcement_id) REFERENCES announcements(id)
        ON DELETE SET NULL
);

-- Index for user's notifications (unread first, then recent)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC);

COMMENT ON TABLE notifications IS 'User-targeted notifications';
COMMENT ON COLUMN notifications.user_id IS 'FK to users.id. ON DELETE CASCADE (notifications go with user).';
COMMENT ON COLUMN notifications.type IS 'Categorical notification type';