-- =====================================================
-- Migration 012: Messages
-- Step 6.5 — Database Design
-- =====================================================
-- Direct messaging between users.
-- sender_id and receiver_id are both REQUIRED (NOT NULL).
-- Both use ON DELETE RESTRICT.
-- No generic created_by field.
-- =====================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    subject VARCHAR(255),
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_messages_receiver
        FOREIGN KEY (receiver_id) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_messages_different_users
        CHECK (sender_id != receiver_id)
);

-- Index for inbox queries (receiver_id)
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read, created_at DESC);
-- Index for sent messages (sender_id)
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);

COMMENT ON TABLE messages IS 'Direct messages between users';
COMMENT ON COLUMN messages.sender_id IS 'NOT NULL FK to users.id. ON DELETE RESTRICT.';
COMMENT ON COLUMN messages.receiver_id IS 'NOT NULL FK to users.id. ON DELETE RESTRICT.';