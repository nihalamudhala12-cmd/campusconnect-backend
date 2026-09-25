/**
 * Student Repository
 * M3 — Students
 *
 * Concrete repository for student profiles.
 * Uses BaseRepository with department scope derived through user relationships.
 */

const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../errors');

class StudentRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT sp.id, sp.user_id, sp.roll_number, sp.admission_number, sp.semester, sp.status,
              u.name as user_name, u.email as user_email, u.role as user_role, u.department_id as user_department_id, u.status as user_status
       FROM student_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByUserId(userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT sp.id, sp.user_id, sp.roll_number, sp.admission_number, sp.semester, sp.status,
              u.name as user_name, u.email as user_email, u.role as user_role, u.department_id as user_department_id, u.status as user_status
       FROM student_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('student_profiles', departmentId, params, 'sp');

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = [clause];
    const queryParams = [...params];

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`sp.status = $${statusIndex}`);
    }

    if (options.classId) {
      queryParams.push(options.classId);
      const classIndex = queryParams.length;
      whereConditions.push(`sp.id IN (SELECT DISTINCT student_id FROM attendance WHERE class_id = $${classIndex})`);
    }

    if (options.semester) {
      queryParams.push(parseInt(options.semester, 10));
      const semIndex = queryParams.length;
      whereConditions.push(`sp.semester = $${semIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`(LOWER(sp.roll_number) LIKE $${searchIndex} OR LOWER(sp.admission_number) LIKE $${searchIndex})`);
    }

    if (options.userId) {
      queryParams.push(options.userId);
      const userIndex = queryParams.length;
      whereConditions.push(`sp.user_id = $${userIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM student_profiles sp ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT sp.id, sp.user_id, sp.roll_number, sp.admission_number, sp.semester, sp.status, sp.created_at,
                              users_dept.name as user_name, users_dept.email as user_email, users_dept.role as user_role, users_dept.department_id as user_department_id, users_dept.status as user_status
       FROM student_profiles sp ${join}
       WHERE ${whereClause}
       ORDER BY users_dept.name ASC
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
      `INSERT INTO student_profiles (id, user_id, roll_number, admission_number, semester, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING id, user_id, roll_number, admission_number, semester, status, created_at`,
      [
        data.userId,
        data.rollNumber || null,
        data.admissionNumber || null,
        data.semester !== undefined ? parseInt(data.semester, 10) : null,
        data.status ? data.status.toUpperCase() : 'ACTIVE',
      ],
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

    if (data.rollNumber !== undefined) {
      setClauses.push(`roll_number = $${idx++}`);
      params.push(data.rollNumber || null);
    }
    if (data.admissionNumber !== undefined) {
      setClauses.push(`admission_number = $${idx++}`);
      params.push(data.admissionNumber || null);
    }
    if (data.semester !== undefined) {
      setClauses.push(`semester = $${idx++}`);
      params.push(parseInt(data.semester, 10));
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
      `UPDATE student_profiles SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, user_id, roll_number, admission_number, semester, status, created_at`,
      params
    );

    return result.rows[0];
  }

  async deactivate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE student_profiles SET status = 'INACTIVE' WHERE id = $1
       RETURNING id, user_id, roll_number, admission_number, semester, status, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdForUpdate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT sp.id, sp.user_id, sp.roll_number, sp.admission_number, sp.semester, sp.status,
              u.name as user_name, u.email as user_email, u.role as user_role, u.department_id as user_department_id, u.status as user_status
       FROM student_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE sp.id = $1
       FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getByUserId(userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id FROM student_profiles WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async userExists(userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'STUDENT'`,
      [userId]
    );
    return result.rows.length > 0;
  }
}

module.exports = StudentRepository;