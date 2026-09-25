-- =====================================================
-- Migration 008: Timetable Entries
-- Step 6.5 — Database Design
-- =====================================================
-- Contextual teaching relationship:
--   faculty_id -> faculty/user identity (users table)
--   class_id   -> classes
--   course_id  -> courses
-- No separate faculty_courses / faculty_classes tables.
-- =====================================================

CREATE TABLE IF NOT EXISTS timetable_entries (
    id UUID PRIMARY KEY,
    faculty_id UUID NOT NULL,
    class_id UUID NOT NULL,
    course_id UUID NOT NULL,
    day_of_week VARCHAR(10) NOT NULL
        CHECK (day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_timetable_faculty
        FOREIGN KEY (faculty_id) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_timetable_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_timetable_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_timetable_time
        CHECK (end_time > start_time)
);

-- Index for fast lookup by class+day (common query)
CREATE INDEX IF NOT EXISTS idx_timetable_class_day ON timetable_entries(class_id, day_of_week);
-- Index for fast lookup by faculty (common query)
CREATE INDEX IF NOT EXISTS idx_timetable_faculty ON timetable_entries(faculty_id);

COMMENT ON TABLE timetable_entries IS 'Timetable with embedded faculty-class-course relationship';
COMMENT ON COLUMN timetable_entries.faculty_id IS 'FK to users.id (faculty user). Application validates role=FACULTY/HOD.';
COMMENT ON COLUMN timetable_entries.status IS 'UPPER_SNAKE_CASE status: ACTIVE or INACTIVE';