/**
 * Migration Execution Order
 * Step 6.5 — Database Design
 *
 * This file defines the order in which migrations must be executed.
 * Order is critical to resolve FK dependencies without circular reference issues.
 *
 * MIGRATION ORDER:
 * 1. 001_departments.sql     - Core entity (no FK dependencies)
 * 2. 002_users.sql          - Depends on departments (department_id FK)
 * 3. 003_faculty_profiles.sql - Depends on users
 * 4. 004_student_profiles.sql - Depends on users
 * 5. 005_classes.sql         - Depends on departments
 * 6. 006_courses.sql         - Depends on departments
 * 7. 007_class_courses.sql   - Depends on classes, courses
 * 8. 008_timetable_entries.sql - Depends on classes, courses, faculty (users)
 * 9. 009_attendance.sql       - Depends on students, classes, courses, faculty
 * 10. 010_results.sql         - Depends on students, courses
 * 11. 011_approvals.sql       - Depends on users
 * 12. 012_messages.sql        - Depends on users
 * 13. 013_chat_rooms.sql      - Depends on users
 * 14. 014_announcements.sql   - Depends on users, departments
 * 15. 015_notifications.sql   - Depends on users
 *
 * NOTE ON DEPARTMENTS/USER CYCLE:
 * - departments.created_by references users.id (FK added after users table exists)
 * - This is handled by using ALTER TABLE after both tables exist
 * - The FK is NOT part of the initial CREATE TABLE for departments
 */

module.exports = {
  migrations: [
    '001_departments.sql',
    '002_users.sql',
    '003_faculty_profiles.sql',
    '004_student_profiles.sql',
    '005_classes.sql',
    '006_courses.sql',
    '007_class_courses.sql',
    '008_timetable_entries.sql',
    '009_attendance.sql',
    '010_results.sql',
    '011_approvals.sql',
    '012_messages.sql',
    '013_chat_rooms.sql',
    '014_announcements.sql',
    '015_notifications.sql',
    '016_sessions.sql',
    '017_devices.sql',
    '018_system_config.sql',
    '019_enrolment.sql',
    '020_mfa.sql',
    '021_profile_completed.sql',
    '099_department_created_by_fk.sql',
    '100_chat_rooms_name_unique.sql'
  ]
};
