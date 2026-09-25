-- =====================================================
-- Migration 007: Class Courses (Curriculum Mapping)
-- Step 6.5 — Database Design
-- =====================================================
-- The curriculum/source-of-truth mapping between classes and courses.
-- Composite PK (class_id, course_id) ensures no duplicates.
-- No standalone id column — composite PK is sufficient.
-- =====================================================

CREATE TABLE IF NOT EXISTS class_courses (
    class_id UUID NOT NULL,
    course_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, course_id),
    CONSTRAINT fk_class_courses_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_class_courses_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
);

-- No separate indexes on class_id or course_id — composite PK provides them.
-- The composite PK (class_id, course_id) supports queries on either side efficiently.

COMMENT ON TABLE class_courses IS 'Curriculum mapping: which courses belong to which classes';
COMMENT ON CONSTRAINT class_courses_pkey ON class_courses IS 'Composite PK prevents duplicate class/course combinations';