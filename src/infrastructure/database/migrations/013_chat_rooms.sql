-- =====================================================
-- Migration 013: Chat Rooms
-- Step 6.5 — Database Design
-- =====================================================
-- Single created_by field (no duplication).
-- Participants handled at application boundary (no participant table).
-- Per validated design, chat_room_participants is NOT created.
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(150),
    room_type VARCHAR(20) NOT NULL DEFAULT 'DIRECT'
        CHECK (room_type IN ('DIRECT', 'GROUP', 'DEPARTMENT')),
    created_by UUID NOT NULL,
    department_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_chat_rooms_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_chat_rooms_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE SET NULL
);

-- Index for chat rooms created by a user
CREATE INDEX IF NOT EXISTS idx_chat_rooms_creator ON chat_rooms(created_by);

COMMENT ON TABLE chat_rooms IS 'Chat rooms (direct, group, department)';
COMMENT ON COLUMN chat_rooms.created_by IS 'FK to users.id. ON DELETE RESTRICT. Single created_by column only.';
COMMENT ON COLUMN chat_rooms.room_type IS 'UPPER_SNAKE_CASE: DIRECT, GROUP, DEPARTMENT';
COMMENT ON COLUMN chat_rooms.status IS 'UPPER_SNAKE_CASE: ACTIVE, ARCHIVED';