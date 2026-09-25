-- =====================================================
-- Migration 017: Devices
-- Step 6.5 — Database Design
-- =====================================================
-- User device information for tracking and security.
-- Separate from sessions for cleaner lifecycle management.
-- =====================================================

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL
        CHECK (device_type IN ('DESKTOP', 'MOBILE', 'TABLET', 'WEARABLE')),
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(20),
    push_token VARCHAR(500),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_devices_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- Index for user's devices
CREATE INDEX IF NOT EXISTS idx_devices_user_active
    ON devices(user_id, is_active, last_seen_at DESC);

COMMENT ON TABLE devices IS 'User registered devices for push notifications and device management';
COMMENT ON COLUMN devices.device_name IS 'User-friendly device name';
COMMENT ON COLUMN devices.device_type IS 'Type of device: DESKTOP, MOBILE, TABLET, WEARABLE';
