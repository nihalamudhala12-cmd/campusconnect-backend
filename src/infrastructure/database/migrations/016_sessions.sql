-- =====================================================
-- Migration 016: Sessions
-- Step 6.5 — Database Design
-- =====================================================
-- Session tokens and device tracking for authentication lifecycle.
-- Used by future Authentication & Security phase.
-- =====================================================

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token VARCHAR(500) NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    department_id UUID,
    location_info JSONB,
    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sessions_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE SET NULL
);

-- Index for user sessions (active first, then recent)
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
    ON sessions(user_id, is_active DESC, last_accessed_at DESC);

-- Index for token lookup (used by auth middleware)
CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON sessions(token);

COMMENT ON TABLE sessions IS 'User authentication sessions for tracking device-based authentication';
COMMENT ON COLUMN sessions.token IS 'Session token for authentication';
COMMENT ON COLUMN sessions.device_fingerprint IS 'Unique device identifier';
COMMENT ON COLUMN sessions.ip_address IS 'IP address for security auditing';
