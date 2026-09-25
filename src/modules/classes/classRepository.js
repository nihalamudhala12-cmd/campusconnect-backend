/**
 * Class Repository
 * M5 — Classes
 */

const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');

class ClassRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, code, department_id, semester, section, status, created_at
       FROM classes WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('classes', departmentId, params);

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

    if (options.semester) {
      queryParams.push(parseInt(options.semester, 10));
      const semIndex = queryParams.length;
      whereConditions.push(`semester = $${semIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`(LOWER(name) LIKE $${searchIndex} OR LOWER(code) LIKE $${searchIndex})`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM classes ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, name, code, department_id, semester, section, status, created_at
       FROM classes ${join}
       WHERE ${whereClause}
       ORDER BY name ASC
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
      `INSERT INTO classes (id, name, code, department_id, semester, section, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING id, name, code, department_id, semester, section, status, created_at`,
      [
        data.name,
        data.code.toUpperCase(),
        data.departmentId,
        data.semester !== undefined ? parseInt(data.semester, 10) : null,
        data.section || null,
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

    if (data.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(data.name);
    }
    if (data.code !== undefined) {
      setClauses.push(`code = $${idx++}`);
      params.push(data.code.toUpperCase());
    }
    if (data.departmentId !== undefined) {
      setClauses.push(`department_id = $${idx++}`);
      params.push(data.departmentId);
    }
    if (data.semester !== undefined) {
      setClauses.push(`semester = $${idx++}`);
      params.push(parseInt(data.semester, 10));
    }
    if (data.section !== undefined) {
      setClauses.push(`section = $${idx++}`);
      params.push(data.section || null);
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
      `UPDATE classes SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, name, code, department_id, semester, section, status, created_at`,
      params
    );

    return result.rows[0];
  }

  async deactivate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE classes SET status = 'INACTIVE' WHERE id = $1
       RETURNING id, name, code, department_id, semester, section, status, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdForUpdate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, code, department_id, semester, section, status, created_at
       FROM classes WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async codeExists(code, departmentId, excludeId = null, client = null) {
    const runner = this.getRunner(client);
    const params = [code.toUpperCase(), departmentId];
    let query = 'SELECT id FROM classes WHERE LOWER(code) = LOWER($1) AND department_id = $2';
    if (excludeId) {
      params.push(excludeId);
      query += ' AND id != $3';
    }
    const result = await runner.query(query, params);
    return result.rows.length > 0;
  }
}

module.exports = ClassRepository;