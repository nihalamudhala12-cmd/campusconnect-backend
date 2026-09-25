const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'campusconnect',
  user: 'postgres',
  password: 'postgres123',
});

async function seed() {
  try {
    // Clean existing data
    await pool.query('SET session_replication_role = replica');
    const tables = ['enrolment','attendance','results','timetable_entries','class_courses','classes','courses','announcements','notifications','messages','approvals','chat_rooms','faculty_profiles','student_profiles','users','departments'];
    for (const t of tables) {
      await pool.query(`DELETE FROM ${t}`);
    }
    await pool.query('SET session_replication_role = default');

    const adminHash = await bcrypt.hash('AdminPass123!', 12);
    const pwHash = await bcrypt.hash('TestPass123!', 12);
    const parentHash = await bcrypt.hash('ParentPass123!', 12);

    // Departments
    const deptRes = await pool.query(`
      INSERT INTO departments (id, name, code, status, created_at) VALUES
        (gen_random_uuid(), 'Computer Science & Engineering', 'CSE', 'ACTIVE', NOW()),
        (gen_random_uuid(), 'Mathematics', 'MATH', 'ACTIVE', NOW())
      RETURNING id, code
    `);
    const cseDept = deptRes.rows.find(r => r.code === 'CSE');
    const mathDept = deptRes.rows.find(r => r.code === 'MATH');

    // Users - using test credentials from project test files (self_audit.js: student@test.com/TestPass123!, principal@test.com/AdminPass123!)
    const userRes = await pool.query(`
      INSERT INTO users (id, name, email, role, department_id, password_hash, status, mfa_enabled, mfa_secret, profile_completed, created_at) VALUES
        (gen_random_uuid(), 'Dr. Principal', 'principal@test.com', 'PRINCIPAL', null, $1, 'ACTIVE', false, null, true, NOW()),
        (gen_random_uuid(), 'Dr. HOD CSE', 'hodcse@test.edu', 'HOD', $2, $1, 'ACTIVE', false, null, true, NOW()),
        (gen_random_uuid(), 'Dr. HOD Math', 'hodmath@test.edu', 'HOD', $3, $1, 'ACTIVE', false, null, true, NOW()),
        (gen_random_uuid(), 'Prof. Faculty CSE', 'facultycs@test.edu', 'FACULTY', $2, $1, 'ACTIVE', false, null, true, NOW()),
        (gen_random_uuid(), 'Student One', 'student@test.com', 'STUDENT', $2, $4, 'ACTIVE', true, null, false, NOW()),
        (gen_random_uuid(), 'Student Two', 'student2@test.edu', 'STUDENT', $2, $4, 'ACTIVE', false, null, false, NOW()),
        (gen_random_uuid(), 'Student Math', 'studentmath@test.edu', 'STUDENT', $3, $4, 'ACTIVE', false, null, false, NOW()),
        (gen_random_uuid(), 'Parent Guardian', 'parent@test.edu', 'PARENT', $2, $5, 'ACTIVE', false, null, true, NOW())
      RETURNING id, email, role, department_id, mfa_enabled
    `, [adminHash, cseDept.id, mathDept.id, pwHash, parentHash]);

    const ub = {};
    userRes.rows.forEach(r => { ub[r.email] = { id: r.id, role: r.role, deptId: r.department_id, mfa: r.mfa_enabled }; });

    console.log('Users created:', userRes.rows.length);

    // Faculty profiles
    await pool.query('INSERT INTO faculty_profiles (id, user_id, employee_id, designation, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
      [ub['facultycs@test.edu'].id, 'EMP003', 'Assistant Professor', 'ACTIVE']);
    await pool.query('INSERT INTO faculty_profiles (id, user_id, employee_id, designation, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
      [ub['hodcse@test.edu'].id, 'EMP001', 'HOD', 'ACTIVE']);
    await pool.query('INSERT INTO faculty_profiles (id, user_id, employee_id, designation, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
      [ub['hodmath@test.edu'].id, 'EMP002', 'HOD', 'ACTIVE']);

    // Student profiles
    await pool.query('INSERT INTO student_profiles (id, user_id, roll_number, admission_number, semester, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
      [ub['student@test.com'].id, 'ROLL001', 'ADM001', 3, 'ACTIVE']);
    await pool.query('INSERT INTO student_profiles (id, user_id, roll_number, admission_number, semester, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
      [ub['student2@test.edu'].id, 'ROLL002', 'ADM002', 3, 'ACTIVE']);
    await pool.query('INSERT INTO student_profiles (id, user_id, roll_number, admission_number, semester, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
      [ub['studentmath@test.edu'].id, 'ROLL003', 'ADM003', 1, 'ACTIVE']);

    // Classes
    const classRes = await pool.query(`
      INSERT INTO classes (id, name, code, department_id, semester, section, status, created_at) VALUES
        (gen_random_uuid(), 'B.Tech CSE Sem 3', 'CSE-BTECH', $1, 3, 'A', 'ACTIVE', NOW()),
        (gen_random_uuid(), 'B.Tech MATH Sem 1', 'MATH-BTECH', $2, 1, 'A', 'ACTIVE', NOW())
      RETURNING id, code
    `, [cseDept.id, mathDept.id]);
    const cs = classRes.rows.find(r => r.code === 'CSE-BTECH');
    const ms = classRes.rows.find(r => r.code === 'MATH-BTECH');

    // Courses
    const courseRes = await pool.query(`
      INSERT INTO courses (id, name, code, department_id, credits, semester, status, created_at) VALUES
        (gen_random_uuid(), 'Data Structures', 'DS-CSE', $1, 4, 3, 'ACTIVE', NOW()),
        (gen_random_uuid(), 'Algorithms', 'ALGO-CSE', $1, 4, 3, 'ACTIVE', NOW()),
        (gen_random_uuid(), 'Calculus', 'CALC-MATH', $2, 3, 1, 'ACTIVE', NOW())
      RETURNING id, code
    `, [cseDept.id, mathDept.id]);
    const ds = courseRes.rows.find(r => r.code === 'DS-CSE');
    const al = courseRes.rows.find(r => r.code === 'ALGO-CSE');
    const ca = courseRes.rows.find(r => r.code === 'CALC-MATH');

    // Class-Courses
    await pool.query('INSERT INTO class_courses (class_id, course_id) VALUES ($1, $2), ($1, $3), ($4, $5)',
      [cs.id, ds.id, al.id, ms.id, ca.id]);

    // Enrolment (use department_id directly, not class_id)
    await pool.query('INSERT INTO enrolment (id, user_id, department_id, semester, academic_year, attendance, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 3, $3, $4, NOW(), NOW())',
      [ub['student@test.com'].id, cseDept.id, '2025-26', 'PRESENT']);
    await pool.query('INSERT INTO enrolment (id, user_id, department_id, semester, academic_year, attendance, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 3, $3, $4, NOW(), NOW())',
      [ub['student2@test.edu'].id, cseDept.id, '2025-26', 'PRESENT']);
    await pool.query('INSERT INTO enrolment (id, user_id, department_id, semester, academic_year, attendance, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, NOW(), NOW())',
      [ub['studentmath@test.edu'].id, mathDept.id, '2025-26', 'PRESENT']);

    // Timetable
    await pool.query(`
      INSERT INTO timetable_entries (id, faculty_id, class_id, course_id, day_of_week, start_time, end_time, room, status, created_at) VALUES
        (gen_random_uuid(), $1, $2, $3, 'MONDAY', '09:00:00', '10:30:00', 'R101', 'ACTIVE', NOW()),
        (gen_random_uuid(), $1, $2, $4, 'WEDNESDAY', '09:00:00', '10:30:00', 'R101', 'ACTIVE', NOW()),
        (gen_random_uuid(), $5, $6, $7, 'TUESDAY', '10:00:00', '11:30:00', 'R202', 'ACTIVE', NOW())
    `, [ub['facultycs@test.edu'].id, cs.id, ds.id, al.id, ub['hodmath@test.edu'].id, ms.id, ca.id]);

    // Attendance - status column is PRESENT/ABSENT/LATE
    await pool.query(`
      INSERT INTO attendance (id, student_id, faculty_id, class_id, course_id, attendance_date, status, remarks, created_at) VALUES
        (gen_random_uuid(), $1, $3, $4, $5, CURRENT_DATE - INTERVAL '1 day', 'PRESENT', NULL, NOW()),
        (gen_random_uuid(), $1, $3, $4, $5, CURRENT_DATE - INTERVAL '2 days', 'PRESENT', NULL, NOW()),
        (gen_random_uuid(), $1, $3, $4, $6, CURRENT_DATE - INTERVAL '1 day', 'ABSENT', NULL, NOW()),
        (gen_random_uuid(), $2, $3, $4, $5, CURRENT_DATE - INTERVAL '1 day', 'PRESENT', NULL, NOW()),
        (gen_random_uuid(), $7, $8, $9, $10, CURRENT_DATE - INTERVAL '1 day', 'PRESENT', NULL, NOW())
    `, [ub['student@test.com'].id, ub['student2@test.edu'].id, ub['facultycs@test.edu'].id, cs.id, ds.id, al.id, ub['studentmath@test.edu'].id, ub['hodmath@test.edu'].id, ms.id, ca.id]);

    // Results - no class_id column, has semester and academic_year
    await pool.query(`
      INSERT INTO results (id, student_id, course_id, assessment_type, semester, academic_year, marks_obtained, max_marks, grade, status, created_at) VALUES
        (gen_random_uuid(), $1, $2, 'END_TERM', 3, '2025-26', 85, 100, 'A', 'PUBLISHED', NOW()),
        (gen_random_uuid(), $1, $3, 'END_TERM', 3, '2025-26', 72, 100, 'B', 'PUBLISHED', NOW()),
        (gen_random_uuid(), $4, $2, 'END_TERM', 3, '2025-26', 90, 100, 'A', 'PUBLISHED', NOW()),
        (gen_random_uuid(), $5, $6, 'END_TERM', 1, '2025-26', 78, 100, 'B', 'PUBLISHED', NOW())
    `, [ub['student@test.com'].id, ds.id, al.id, ub['student2@test.edu'].id, ub['studentmath@test.edu'].id, ca.id]);

    // Announcements - type: ANNOUNCEMENT/ALERT, priority: NORMAL/IMPORTANT/URGENT, audience: DEPARTMENT/ALL/PENDING_INSTITUTION_WIDE, status: ACTIVE/INACTIVE/PENDING_AUTHORIZATION
    await pool.query(`
      INSERT INTO announcements (id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at) VALUES
        (gen_random_uuid(), 'Welcome to CampusConnect', 'Welcome to the new semester!', 'ANNOUNCEMENT', $1, null, 'ALL', 'ACTIVE', 'URGENT', NOW(), NOW()),
        (gen_random_uuid(), 'CSE Department Notice', 'Mid-term exam schedule released.', 'ANNOUNCEMENT', $2, $3, 'DEPARTMENT', 'ACTIVE', 'IMPORTANT', NOW(), NOW()),
        (gen_random_uuid(), 'Math Department Update', 'New course materials available.', 'ALERT', $4, $5, 'DEPARTMENT', 'ACTIVE', 'NORMAL', NOW(), NOW())
    `, [ub['principal@test.com'].id, ub['hodcse@test.edu'].id, cseDept.id, ub['hodmath@test.edu'].id, mathDept.id]);

    // Notifications
    await pool.query(`
      INSERT INTO notifications (id, user_id, type, title, message, priority, is_read, related_announcement_id, created_at) VALUES
        (gen_random_uuid(), $1, 'ANNOUNCEMENT_PUBLISHED', 'New Announcement', 'Welcome to CampusConnect', 'IMPORTANT', false, NULL, NOW()),
        (gen_random_uuid(), $2, 'SYSTEM', 'System Alert', 'System maintenance scheduled', 'NORMAL', false, NULL, NOW())
    `, [ub['student@test.com'].id, ub['principal@test.com'].id]);

    // Messages
    await pool.query(`
      INSERT INTO messages (id, sender_id, receiver_id, subject, body, is_read, created_at) VALUES
        (gen_random_uuid(), $1, $2, 'Class Update', 'Please check the exam schedule.', true, NOW()),
        (gen_random_uuid(), $3, $2, 'Welcome', 'Welcome to CampusConnect!', false, NOW())
    `, [ub['facultycs@test.edu'].id, ub['student@test.com'].id, ub['principal@test.com'].id]);

    // Approvals
    await pool.query(`
      INSERT INTO approvals (id, type, requested_by, department_id, description, status, created_at) VALUES
        (gen_random_uuid(), 'LEAVE', $1, $2, 'Request for leave on 2025-10-15', 'PENDING', NOW()),
        (gen_random_uuid(), 'LEAVE', $3, $4, 'Request for leave on 2025-10-20', 'APPROVED', NOW())
    `, [ub['student@test.com'].id, cseDept.id, ub['student2@test.edu'].id, mathDept.id]);

    // Chat room
    await pool.query(
      'INSERT INTO chat_rooms (id, name, room_type, created_by, department_id, status, created_at) VALUES (gen_random_uuid(), $1, $2, $3, null, $4, NOW())',
      ['General Discussion', 'GROUP', ub['principal@test.com'].id, 'ACTIVE']
    );

    const policyStr = JSON.stringify({ minLength: 8, requireSpecial: true, requireNumber: true, requireUppercase: true, requireLowercase: true });
    const fileTypes = JSON.stringify(['pdf', 'jpg', 'png']);

    // System config
    await pool.query(`
      INSERT INTO system_config (id, name, academic_year, timezone, language, theme, contact_email, logo_url, favicon_url, secondary_color, welcome_message, footer_text, enable_notifications, notification_email, max_file_upload_size, allowed_file_types, session_timeout, password_policy, created_at, updated_at, created_by, is_deleted)
      VALUES (gen_random_uuid(), 'CampusConnect', '2025-26', 'UTC', 'en', 'SYSTEM', 'admin@campusconnect.edu', null, null, null, 'Welcome to CampusConnect', '© 2025 CampusConnect', true, 'admin@campusconnect.edu', 10, $3, 30, $2, NOW(), NOW(), $1, false)
    `, [ub['principal@test.com'].id, policyStr, fileTypes]);

    console.log('Seed complete.');
  } catch (err) {
    console.error('Seed error:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
