/**
 * Result Repository
 * M7 — Results
 *
 * Concrete repository for assessment results.
 * Department scope is derived through course relationships.
 */

const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../errors');

class ResultRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT r.id, r.student_id, r.course_id, r.assessment_type, r.semester, r.academic_year,
              r.marks_obtained, r.max_marks, r.grade, r.status, r.created_at,
              u_student.name as student_name, u_student.email as student_email,
              co.name as course_name, co.code as course_code,
              courses_dept.department_id as course_department_id
       FROM results r
       JOIN users u_student ON r.student_id = u_student.id
       JOIN courses co ON r.course_id = co.id
       JOIN courses courses_dept ON r.course_id = courses_dept.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('results', departmentId, params, 'r');

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = [clause];
    const queryParams = [...params];

    if (options.studentId) {
      queryParams.push(options.studentId);
      const studentIndex = queryParams.length;
      whereConditions.push(`r.student_id = $${studentIndex}`);
    }

    if (options.courseId) {
      queryParams.push(options.courseId);
      const courseIndex = queryParams.length;
      whereConditions.push(`r.course_id = $${courseIndex}`);
    }

    if (options.assessmentType) {
      queryParams.push(options.assessmentType.toUpperCase());
      const typeIndex = queryParams.length;
      whereConditions.push(`r.assessment_type = $${typeIndex}`);
    }

    if (options.semester) {
      queryParams.push(parseInt(options.semester, 10));
      const semIndex = queryParams.length;
      whereConditions.push(`r.semester = $${semIndex}`);
    }

    if (options.academicYear) {
      queryParams.push(options.academicYear);
      const yearIndex = queryParams.length;
      whereConditions.push(`r.academic_year = $${yearIndex}`);
    }

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`r.status = $${statusIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`(LOWER(u_student.name) LIKE $${searchIndex} OR LOWER(co.name) LIKE $${searchIndex} OR LOWER(co.code) LIKE $${searchIndex})`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM results r ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT r.id, r.student_id, r.course_id, r.assessment_type, r.semester, r.academic_year,
                              r.marks_obtained, r.max_marks, r.grade, r.status, r.created_at,
                              u_student.name as student_name, u_student.email as student_email,
                              co.name as course_name, co.code as course_code,
                              courses_dept.department_id as course_department_id
                       FROM results r
                       JOIN users u_student ON r.student_id = u_student.id
                       JOIN courses co ON r.course_id = co.id
                       ${join}
                       WHERE ${whereClause}
                       ORDER BY r.created_at DESC
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
      `INSERT INTO results (id, student_id, course_id, assessment_type, semester, academic_year, marks_obtained, max_marks, grade, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, student_id, course_id, assessment_type, semester, academic_year, marks_obtained, max_marks, grade, status, created_at`,
      [
        data.studentId,
        data.courseId,
        data.assessmentType.toUpperCase(),
        data.semester !== undefined ? parseInt(data.semester, 10) : null,
        data.academicYear,
        data.marksObtained !== undefined && data.marksObtained !== null ? data.marksObtained : null,
        data.maxMarks,
        data.grade || null,
        data.status ? data.status.toUpperCase() : 'PUBLISHED',
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

    if (data.marksObtained !== undefined) {
      setClauses.push(`marks_obtained = $${idx++}`);
      params.push(data.marksObtained !== null ? data.marksObtained : null);
    }
    if (data.maxMarks !== undefined) {
      setClauses.push(`max_marks = $${idx++}`);
      params.push(data.maxMarks);
    }
    if (data.grade !== undefined) {
      setClauses.push(`grade = $${idx++}`);
      params.push(data.grade || null);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      params.push(data.status.toUpperCase());
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(id);
    const result = await runner.query(
      `UPDATE results SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, student_id, course_id, assessment_type, semester, academic_year, marks_obtained, max_marks, grade, status, created_at`,
      params
    );

    return result.rows[0];
  }

  async delete(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `DELETE FROM results WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdForUpdate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, student_id, course_id, assessment_type, semester, academic_year, marks_obtained, max_marks, grade, status, created_at
       FROM results WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async exists(studentId, courseId, assessmentType, semester, academicYear, excludeId = null, client = null) {
    const runner = this.getRunner(client);
    const params = [studentId, courseId, assessmentType.toUpperCase(), semester, academicYear];
    let query = 'SELECT id FROM results WHERE student_id = $1 AND course_id = $2 AND assessment_type = $3 AND semester = $4 AND academic_year = $5';
    if (excludeId) {
      params.push(excludeId);
      query += ' AND id != $6';
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

  async courseExists(courseId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, department_id FROM courses WHERE id = $1`,
      [courseId]
    );
    return result.rows[0] || null;
  }

  async studentExists(studentId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT sp.id FROM student_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.user_id = $1 AND u.role = 'STUDENT'`,
      [studentId]
    );
    return result.rows[0] || null;
  }
}

module.exports = ResultRepository;