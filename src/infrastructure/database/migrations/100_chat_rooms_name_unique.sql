-- =====================================================
-- Migration 100: Chat Rooms Name Uniqueness
-- Database Design Hardening — Issue #7 Duplicate Data
-- =====================================================
-- Fixes: chat_rooms.name has no uniqueness constraint.
-- Without this, multiple rooms with the same name can be
-- created, defeating the purpose of named chat rooms.
-- 
-- Unique scope: GLOBAL — each chat room name must be unique
-- across the entire system. This prevents duplicate "General"
-- or "CS Dept" rooms from being created.
--
-- Pattern: mirrors uq_<table>_<columns> naming convention.
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_chat_rooms_name'
          AND conrelid = 'chat_rooms'::regclass
    ) THEN
        ALTER TABLE chat_rooms
        ADD CONSTRAINT uq_chat_rooms_name
        UNIQUE (name);
    END IF;
END $$;

COMMENT ON CONSTRAINT uq_chat_rooms_name ON chat_rooms IS
    'Unique chat room name — prevents duplicate room names across the system';
