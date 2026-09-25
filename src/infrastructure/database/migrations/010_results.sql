-- =====================================================
-- Migration 010: Results
-- Step 6.5 — Database Design
-- =====================================================
-- Uniqueness: (student_id, course_id, assessment_type, semester, academic_year)
-- No retest/re-exam functionality per validated design.
-- =====================================================

CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL,
    course_id UUID NOT NULL,
    assessment_type VARCHAR(30) NOT NULL
        CHECK (assessment_type IN ('ASSIGNMENT', 'CLASS_TEST', 'MID_TERM', 'END_TERM', 'LAB', 'PROJECT', 'PRESENTATION', 'PARTICIPATION')),
    semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 10),
    academic_year VARCHAR(9) NOT NULL, -- Format: '2026-27'
    marks_obtained DECIMAL(5,2) CHECK (marks_obtained >= 0),
    max_marks DECIMAL(5,2) NOT NULL CHECK (max_marks > 0),
    grade VARCHAR(5),
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'PUBLISHED', 'REVISION_PENDING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_results_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_results_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_results_unique
        UNIQUE (student_id, course_id, assessment_type, semester, academic_year)
);

-- Index for student results queries
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
-- Index for course results queries
CREATE INDEX IF NOT EXISTS idx_results_course ON results(course_id);

COMMENT ON TABLE results IS 'Assessment results per student per course';
COMMENT ON COLUMN results.academic_year IS 'Academic year in format YYYY-YY (e.g., 2026-27)';
COMMENT ON COLUMN results.status IS 'UPPER_SNAKE_CASE: DRAFT, SUBMITTED, PUBLISHED, REVISION_PENDING';