/**
 * Faculty Repository
 * M4 — Faculty
 *
 * Concrete repository for faculty profiles.
 * Uses BaseRepository with department scope derived through user relationships.
 */

const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');
const { NotFoundError } = require('../../errors');

class FacultyRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT fp.id, fp.user_id, fp.employee_id, fp.designation, fp.status, fp.created_at,
              u.name as user_name, u.email as user_email, u.role as user_role, u.department_id as user_department_id, u.status as user_status
       FROM faculty_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByUserId(userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT fp.id, fp.user_id, fp.employee_id, fp.designation, fp.status, fp.created_at,
              u.name as user_name, u.email as user_email, u.role as user_role, u.department_id as user_department_id, u.status as user_status
       FROM faculty_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('faculty_profiles', departmentId, params, 'fp');

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = [clause];
    const queryParams = [...params];

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`fp.status = $${statusIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`(LOWER(fp.employee_id) LIKE $${searchIndex} OR LOWER(fp.designation) LIKE $${searchIndex})`);
    }

    if (options.userId) {
      queryParams.push(options.userId);
      const userIndex = queryParams.length;
      whereConditions.push(`fp.user_id = $${userIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM faculty_profiles fp ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT fp.id, fp.user_id, fp.employee_id, fp.designation, fp.status, fp.created_at,
                              users_dept.name as user_name, users_dept.email as user_email, users_dept.role as user_role, users_dept.department_id as user_department_id, users_dept.status as user_status
       FROM faculty_profiles fp ${join}
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
      `INSERT INTO faculty_profiles (id, user_id, employee_id, designation, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING id, user_id, employee_id, designation, status, created_at`,
      [
        data.userId,
        data.employeeId || null,
        data.designation || null,
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

    if (data.employeeId !== undefined) {
      setClauses.push(`employee_id = $${idx++}`);
      params.push(data.employeeId || null);
    }
    if (data.designation !== undefined) {
      setClauses.push(`designation = $${idx++}`);
      params.push(data.designation || null);
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
      `UPDATE faculty_profiles SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, user_id, employee_id, designation, status, created_at`,
      params
    );

    return result.rows[0];
  }

  async deactivate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE faculty_profiles SET status = 'INACTIVE' WHERE id = $1
       RETURNING id, user_id, employee_id, designation, status, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdForUpdate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT fp.id, fp.user_id, fp.employee_id, fp.designation, fp.status, fp.created_at,
              u.name as user_name, u.email as user_email, u.role as user_role, u.department_id as user_department_id, u.status as user_status
       FROM faculty_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.id = $1
       FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getByUserId(userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id FROM faculty_profiles WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async userExists(userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id FROM users WHERE id = $1 AND role IN ('FACULTY', 'HOD')`,
      [userId]
    );
    return result.rows.length > 0;
  }
}

module.exports = FacultyRepository;