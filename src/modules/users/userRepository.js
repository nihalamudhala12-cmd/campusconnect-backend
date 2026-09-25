/**
 * User Repository
 * Step 6.7 — API Module 1: Users
 *
 * Concrete repository for users table.
 * Uses BaseRepository with department scope and transaction support.
 * NEVER selects or returns password_hash.
 */
const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');
const { ConflictError } = require('../../errors');

class UserRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, email, role, department_id, status, profile_completed, last_active, created_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('users', departmentId, params);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = [clause];
    const queryParams = [...params];

    if (options.role) {
      queryParams.push(options.role.toUpperCase());
      const roleIndex = queryParams.length;
      whereConditions.push(`role = $${roleIndex}`);
    }

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`status = $${statusIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`LOWER(name) LIKE $${searchIndex} OR LOWER(email) LIKE $${searchIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM users ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, name, email, role, department_id, status, profile_completed, last_active, created_at
                       FROM users
                       ${join}
                       WHERE ${whereClause}
                       ORDER BY created_at DESC
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
      `INSERT INTO users (id, name, email, role, department_id, status, profile_completed)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, department_id, status, profile_completed, last_active, created_at`,
      [
        data.name,
        data.email,
        data.role.toUpperCase(),
        data.departmentId || null,
        data.status ? data.status.toUpperCase() : 'ACTIVE',
        data.profileCompleted !== undefined ? data.profileCompleted : false,
      ]
    );
    return result.rows[0];
  }

  async findByIdentifier(identifier, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, email, role, department_id, status, password_hash, last_active, created_at
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [identifier]
    );
    return result.rows[0] || null;
  }

  async findByIdForUpdate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, email, role, department_id, status, profile_completed, password_hash, last_active, created_at
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [id]
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
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      params.push(data.email);
    }
    if (data.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      params.push(data.role.toUpperCase());
    }
    if (data.departmentId !== undefined) {
      setClauses.push(`department_id = $${paramIndex++}`);
      params.push(data.departmentId || null);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(data.status.toUpperCase());
    }
    if (data.profileCompleted !== undefined) {
      setClauses.push(`profile_completed = $${paramIndex++}`);
      params.push(data.profileCompleted);
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(id);
    const updateIndex = paramIndex;

    const result = await runner.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${updateIndex}
       RETURNING id, name, email, role, department_id, status, profile_completed, last_active, created_at`,
      params
    );

    return result.rows[0];
  }

  async deactivate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE users SET status = 'INACTIVE' WHERE id = $1
       RETURNING id, name, email, role, department_id, status, profile_completed, last_active, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async emailExists(email, excludeId = null, client = null) {
    const runner = this.getRunner(client);
    const params = [email];
    const query = 'SELECT id FROM users WHERE LOWER(email) = LOWER($1)';
    if (excludeId) {
      params.push(excludeId);
      const result = await runner.query(`${query} AND id != $2`, params);
      return result.rows.length > 0;
    }
    const result = await runner.query(query, params);
    return result.rows.length > 0;
  }
}

module.exports = UserRepository;

