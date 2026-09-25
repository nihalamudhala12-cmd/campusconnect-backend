-- =====================================================
-- Migration 018: System Configuration
-- Step 6.5 — Database Design
-- =====================================================
-- Institution-wide configuration settings.
-- Used by the System Configuration API (M14).
-- Stored as a single row per institution for simplicity.
-- =====================================================

CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    theme VARCHAR(20) NOT NULL
        CHECK (theme IN ('LIGHT', 'DARK', 'SYSTEM')),
    contact_email VARCHAR(255),
    logo_url TEXT,
    favicon_url TEXT,
    secondary_color VARCHAR(20),
    welcome_message TEXT,
    footer_text TEXT,
    enable_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    notification_email VARCHAR(255),
    max_file_upload_size INTEGER NOT NULL DEFAULT 10485760,
    allowed_file_types JSONB NOT NULL DEFAULT '["pdf", "doc", "docx", "jpg", "png"]'::jsonb,
    session_timeout INTEGER NOT NULL DEFAULT 3600,
    password_policy JSONB NOT NULL DEFAULT '{"minLength": 8, "requireSpecial": true, "requireNumber": true, "requireUppercase": true, "requireLowercase": true, "maxAge": 90}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_system_config_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_system_config_timestamps
        CHECK (updated_at >= created_at)
);

-- Index for quick lookup of active configuration
CREATE INDEX IF NOT EXISTS idx_system_config_active
    ON system_config(is_deleted)
    WHERE is_deleted = FALSE;

-- Insert initial configuration (will be populated by service on first access)
-- This is done via application initialization rather than automatic insert

COMMENT ON TABLE system_config IS 'Institution-wide configuration settings for CampusConnect';
COMMENT ON COLUMN system_config.name IS 'Institution name (e.g., "University Campus")';
COMMENT ON COLUMN system_config.academic_year IS 'Current academic year (e.g., "2025-2026")';
COMMENT ON COLUMN system_config.timezone IS 'Institution timezone (IANA format, e.g., "America/New_York")';
COMMENT ON COLUMN system_config.language IS 'Default interface language (ISO 639-1 code, e.g., "EN")';
COMMENT ON COLUMN system_config.theme IS 'UI theme preference: LIGHT, DARK, or SYSTEM';
COMMENT ON COLUMN system_config.contact_email IS 'Primary contact email for institution';
COMMENT ON COLUMN system_config.logo_url IS 'URL to institution logo';
COMMENT ON COLUMN system_config.favicon_url IS 'URL to institution favicon';
COMMENT ON COLUMN system_config.secondary_color IS 'Secondary brand color (hex code)';
COMMENT ON COLUMN system_config.welcome_message IS 'Welcome message displayed on login page';
COMMENT ON COLUMN system_config.footer_text IS 'Footer text displayed on all pages';
COMMENT ON COLUMN system_config.enable_notifications IS 'Whether system notifications are enabled';
COMMENT ON COLUMN system_config.notification_email IS 'Email for system notifications';
COMMENT ON COLUMN system_config.max_file_upload_size IS 'Maximum file upload size in bytes';
COMMENT ON COLUMN system_config.allowed_file_types IS 'Array of allowed file extensions for upload';
COMMENT ON COLUMN system_config.session_timeout IS 'Session timeout in seconds';
COMMENT ON COLUMN system_config.password_policy IS 'Password policy JSON configuration';
COMMENT ON COLUMN system_config.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN system_config.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN system_config.created_by IS 'User ID of creator';
