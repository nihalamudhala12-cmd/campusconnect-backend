-- =====================================================
-- Migration 009: Attendance
-- Step 6.5 — Database Design
-- =====================================================
-- Contextual relationship: student + class + course
-- No student_courses table — this is the contextual record.
-- Uniqueness: (student_id, class_id, course_id, attendance_date)
-- =====================================================

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL,
    faculty_id UUID NOT NULL,
    class_id UUID NOT NULL,
    course_id UUID NOT NULL,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_attendance_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_faculty
        FOREIGN KEY (faculty_id) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_attendance_unique
        UNIQUE (student_id, class_id, course_id, attendance_date)
);

-- Index for queries by date+class (common reporting query)
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, attendance_date);
-- Index for queries by student
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

COMMENT ON TABLE attendance IS 'Daily attendance with student+class+course context';
COMMENT ON COLUMN attendance.student_id IS 'FK to users.id (student user)';
COMMENT ON COLUMN attendance.faculty_id IS 'FK to users.id (faculty user who recorded)';
COMMENT ON COLUMN attendance.status IS 'UPPER_SNAKE_CASE: PRESENT, ABSENT, or LATE';