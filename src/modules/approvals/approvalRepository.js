const BaseRepository = require('../../repositories/baseRepository');

class ApprovalRepository extends BaseRepository {
  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, type, requested_by, department_id, description, status, reviewed_by, reviewed_at, remarks, created_at
       FROM approvals
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(requestingUserId, departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const queryParams = [];

    // SCOPE FIX: Ensure user can only see approvals they have permission to access
    if (departmentId === 'ALL') {
      // PRINCIPAL can see all approvals
      whereClause = `requested_by = $${queryParams.length + 1}`;
      queryParams.push(requestingUserId);
    } else {
      // Non-PRINCIPAL can see:
      // 1. Their own approvals
      // 2. Approvals in their department
      whereClause = `(requested_by = $${queryParams.length + 1} OR department_id = $${queryParams.length + 2})`;
      queryParams.push(requestingUserId);
      queryParams.push(departmentId);
    }

    // Filter by type
    if (options.type) {
      if (whereClause) {
        whereClause += ' AND ';
      }
      queryParams.push(options.type);
      whereClause += `type = $${queryParams.length}`;
    }

    // Filter by status
    if (options.status) {
      if (whereClause) {
        whereClause += ' AND ';
      }
      queryParams.push(options.status);
      whereClause += `status = $${queryParams.length}`;
    }

    const whereClauseStr = whereClause ? `WHERE ${whereClause}` : '';

    const countQuery = `SELECT COUNT(*)::int as total FROM approvals ${whereClauseStr}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, type, requested_by, department_id, description, status, reviewed_by, reviewed_at, remarks, created_at
                       FROM approvals
                       ${whereClauseStr}
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

  async findPending(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE status = $1';
    const queryParams = ['PENDING'];

    // Only show approvals in the requesting user's department or all if PRINCIPAL
    if (departmentId !== 'ALL') {
      whereClause += ` AND department_id = $${queryParams.length + 1}`;
      queryParams.push(departmentId);
    }

    const whereClauseStr = whereClause.startsWith('WHERE') ? whereClause : (whereClause ? `WHERE ${whereClause}` : '');

    const countQuery = `SELECT COUNT(*)::int as total FROM approvals ${whereClauseStr}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, type, requested_by, department_id, description, status, reviewed_by, reviewed_at, remarks, created_at
                       FROM approvals
                       ${whereClauseStr}
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
      `INSERT INTO approvals (id, type, requested_by, department_id, description, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING id, type, requested_by, department_id, description, status, reviewed_by, reviewed_at, remarks, created_at`,
      [
        data.type,
        data.requestedBy,
        data.departmentId,
        data.description || null,
        data.status,
      ]
    );
    return result.rows[0];
  }

  async update(id, data, client = null) {
    const runner = this.getRunner(client);

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.reviewedBy !== undefined) {
      setClauses.push(`reviewed_by = $${paramIndex++}`);
      params.push(data.reviewedBy);
    }
    if (data.reviewedAt !== undefined) {
      setClauses.push(`reviewed_at = $${paramIndex++}`);
      params.push(data.reviewedAt);
    }
    if (data.remarks !== undefined) {
      setClauses.push(`remarks = $${paramIndex++}`);
      params.push(data.remarks);
    }

    if (setClauses.length === 0) {
      return null;
    }

    params.push(id);
    const updateIndex = paramIndex;

    const result = await runner.query(
      `UPDATE approvals SET ${setClauses.join(', ')} WHERE id = $${updateIndex}
       RETURNING id, type, requested_by, department_id, description, status, reviewed_by, reviewed_at, remarks, created_at`,
      params
    );

    return result.rows[0] || null;
  }

  async findUserById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, email, role, department_id
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = ApprovalRepository;
