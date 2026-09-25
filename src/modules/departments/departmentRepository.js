/**
 * Department Repository
 * M2 — Departments
 */
const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');

class DepartmentRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, code, description, status, created_by, created_at FROM departments WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('departments', departmentId, params);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = [clause];
    const queryParams = [...params];

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`status = $${statusIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`(LOWER(name) LIKE $${searchIndex} OR LOWER(code) LIKE $${searchIndex})`);
    }
    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM departments ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, name, code, description, status, created_by, created_at FROM departments ${join} WHERE ${whereClause} ORDER BY name ASC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async create(data, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `INSERT INTO departments (id, name, code, description, status, created_by) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id, name, code, description, status, created_by, created_at`,
      [data.name, data.code.toUpperCase(), data.description || null, data.status ? data.status.toUpperCase() : 'ACTIVE', data.createdBy || null]
    );
    return result.rows[0];
  }

  async update(id, data, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.findById(id, client);
    if (!existing) return null;
    const setClauses = [];
    const params = [];
    let idx = 1;
    if (data.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(data.name); }
    if (data.code !== undefined) { setClauses.push(`code = $${idx++}`); params.push(data.code.toUpperCase()); }
    if (data.description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(data.description); }
    if (data.status !== undefined) { setClauses.push(`status = $${idx++}`); params.push(data.status.toUpperCase()); }
    if (setClauses.length === 0) return existing;
    params.push(id);
    const result = await runner.query(
      `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, name, code, description, status, created_by, created_at`,
      params
    );
    return result.rows[0];
  }

  async deactivate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE departments SET status = 'INACTIVE' WHERE id = $1 RETURNING id, name, code, description, status, created_by, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async codeExists(code, excludeId = null, client = null) {
    const runner = this.getRunner(client);
    const params = [code.toUpperCase()];
    let query = 'SELECT id FROM departments WHERE LOWER(code) = LOWER($1)';
    if (excludeId) { params.push(excludeId); query += ' AND id != $2'; }
    const result = await runner.query(query, params);
    return result.rows.length > 0;
  }
}

module.exports = DepartmentRepository;
