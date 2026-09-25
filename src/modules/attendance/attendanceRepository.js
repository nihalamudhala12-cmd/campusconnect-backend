/**
 * Attendance Repository
 * M6 — Attendance
 *
 * Concrete repository for attendance records.
 * Department scope is derived through class relationships.
 */

const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../errors');

class AttendanceRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT a.id, a.student_id, a.faculty_id, a.class_id, a.course_id,
              a.attendance_date, a.status, a.remarks, a.created_at,
              u_student.name as student_name, u_faculty.name as faculty_name,
              c.name as class_name, c.code as class_code,
              co.name as course_name, co.code as course_code,
              classes_dept.department_id as class_department_id
       FROM attendance a
       JOIN users u_student ON a.student_id = u_student.id
       JOIN users u_faculty ON a.faculty_id = u_faculty.id
       JOIN classes c ON a.class_id = c.id
       JOIN courses co ON a.course_id = co.id
       JOIN classes classes_dept ON a.class_id = classes_dept.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('attendance', departmentId, params, 'a');

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = [clause];
    const queryParams = [...params];

    if (options.studentId) {
      queryParams.push(options.studentId);
      const studentIndex = queryParams.length;
      whereConditions.push(`a.student_id = $${studentIndex}`);
    }

    if (options.facultyId) {
      queryParams.push(options.facultyId);
      const facultyIndex = queryParams.length;
      whereConditions.push(`a.faculty_id = $${facultyIndex}`);
    }

    if (options.classId) {
      queryParams.push(options.classId);
      const classIndex = queryParams.length;
      whereConditions.push(`a.class_id = $${classIndex}`);
    }

    if (options.courseId) {
      queryParams.push(options.courseId);
      const courseIndex = queryParams.length;
      whereConditions.push(`a.course_id = $${courseIndex}`);
    }

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`a.status = $${statusIndex}`);
    }

    if (options.date) {
      queryParams.push(options.date);
      const dateIndex = queryParams.length;
      whereConditions.push(`a.attendance_date = $${dateIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`(LOWER(u_student.name) LIKE $${searchIndex} OR LOWER(u_faculty.name) LIKE $${searchIndex})`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM attendance a ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT a.id, a.student_id, a.faculty_id, a.class_id, a.course_id,
                              a.attendance_date, a.status, a.remarks, a.created_at,
                              u_student.name as student_name, u_faculty.name as faculty_name,
                              c.name as class_name, c.code as class_code,
                              co.name as course_name, co.code as course_code,
                              classes_dept.department_id as class_department_id
       FROM attendance a
       JOIN users u_student ON a.student_id = u_student.id
       JOIN users u_faculty ON a.faculty_id = u_faculty.id
       JOIN classes c ON a.class_id = c.id
       JOIN courses co ON a.course_id = co.id
       ${join}
       WHERE ${whereClause}
       ORDER BY a.attendance_date DESC, a.created_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async create(data, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `INSERT INTO attendance (id, student_id, faculty_id, class_id, course_id, attendance_date, status, remarks)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING id, student_id, faculty_id, class_id, course_id, attendance_date, status, remarks, created_at`,
      [
        data.studentId,
        data.facultyId,
        data.classId,
        data.courseId,
        data.attendanceDate,
        data.status.toUpperCase(),
        data.remarks || null,
      ]
    );
    return result.rows[0] || null;
  }

  async update(id, data, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.findByIdForUpdate(id, client);
    if (!existing) {
      return null;
    }

    const setClauses = [];
    const params = [];
    let idx = 1;

    if (data.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      params.push(data.status.toUpperCase());
    }
    if (data.remarks !== undefined) {
      setClauses.push(`remarks = $${idx++}`);
      params.push(data.remarks || null);
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(id);
    const result = await runner.query(
      `UPDATE attendance SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, student_id, faculty_id, class_id, course_id, attendance_date, status, remarks, created_at`,
      params
    );

    return result.rows[0];
  }

  async delete(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `DELETE FROM attendance WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdForUpdate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, student_id, faculty_id, class_id, course_id, attendance_date, status, remarks, created_at
       FROM attendance WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async exists(studentId, classId, courseId, attendanceDate, excludeId = null, client = null) {
    const runner = this.getRunner(client);
    const params = [studentId, classId, courseId, attendanceDate];
    let query = 'SELECT id FROM attendance WHERE student_id = $1 AND class_id = $2 AND course_id = $3 AND attendance_date = $4';
    if (excludeId) {
      params.push(excludeId);
      query += ' AND id != $5';
    }
    const result = await runner.query(query, params);
    return result.rows.length > 0;
  }

  async userExists(userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async classExists(classId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, department_id FROM classes WHERE id = $1`,
      [classId]
    );
    return result.rows[0] || null;
  }

  async courseExists(courseId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id FROM courses WHERE id = $1`,
      [courseId]
    );
    return result.rows[0] || null;
  }
}

module.exports = AttendanceRepository;
