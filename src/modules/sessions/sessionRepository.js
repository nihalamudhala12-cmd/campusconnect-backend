const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');

class SessionRepository extends BaseRepository {
  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info
       FROM sessions
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByUserId(userId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [userId];
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereConditions = ['user_id = $1'];
    const queryParams = [...params];

    if (options.deviceFingerprint) {
      queryParams.push(options.deviceFingerprint);
      const deviceIndex = queryParams.length;
      whereConditions.push(`device_fingerprint = $${deviceIndex}`);
    }

    if (options.ipAddress) {
      queryParams.push(options.ipAddress);
      const ipIndex = queryParams.length;
      whereConditions.push(`ip_address = $${ipIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM sessions WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info
                       FROM sessions WHERE ${whereClause}
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
      `INSERT INTO sessions (id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $9)
       RETURNING id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info`,
      [
        data.userId,
        data.token,
        data.deviceFingerprint,
        data.ipAddress,
        data.userAgent,
        data.isActive || true,
        data.expiresAt || null,
        data.departmentId || null,
        data.locationInfo || null,
      ]
    );
    return result.rows[0];
  }

  async update(id, data, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.findById(id, client);
    if (!existing) return null;

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (data.token !== undefined) {
      setClauses.push(`token = $${paramIndex++}`);
      params.push(data.token);
    }
    if (data.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }
    if (data.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      params.push(data.expiresAt);
    }
    if (data.lastAccessedAt !== undefined) {
      setClauses.push(`last_accessed_at = $${paramIndex++}`);
      params.push(data.lastAccessedAt);
    }
    if (data.departmentId !== undefined) {
      setClauses.push(`department_id = $${paramIndex++}`);
      params.push(data.departmentId);
    }

    if (setClauses.length === 0) return existing;

    params.push(id);
    const result = await runner.query(
      `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info`,
      params
    );
    return result.rows[0];
  }

  async revoke(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE sessions SET is_active = false WHERE id = $1 RETURNING id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByToken(token, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info
       FROM sessions
       WHERE token = $1`,
      [token]
    );
    return result.rows[0] || null;
  }

  async findDevicesByUserId(userId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [userId];
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereConditions = ['user_id = $1'];
    const queryParams = [...params];

    if (options.deviceFingerprint) {
      queryParams.push(options.deviceFingerprint);
      const deviceIndex = queryParams.length;
      whereConditions.push(`device_fingerprint = $${deviceIndex}`);
    }

    if (options.ipAddress) {
      queryParams.push(options.ipAddress);
      const ipIndex = queryParams.length;
      whereConditions.push(`ip_address = $${ipIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(DISTINCT device_fingerprint) as total FROM sessions WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT DISTINCT device_fingerprint, user_agent, ip_address, location_info, created_at, last_accessed_at
                       FROM sessions WHERE ${whereClause}
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

  async findAll(options = {}, client = null) {
    const runner = this.getRunner(client);
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    const queryParams = [];

    if (options.userId) {
      queryParams.push(options.userId);
      const userIdIndex = queryParams.length;
      whereConditions.push(`user_id = $${userIdIndex}`);
    }

    if (options.deviceFingerprint) {
      queryParams.push(options.deviceFingerprint);
      const deviceIndex = queryParams.length;
      whereConditions.push(`device_fingerprint = $${deviceIndex}`);
    }

    if (options.ipAddress) {
      queryParams.push(options.ipAddress);
      const ipIndex = queryParams.length;
      whereConditions.push(`ip_address = $${ipIndex}`);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

    const countQuery = `SELECT COUNT(*)::int as total FROM sessions WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, user_id, token, device_fingerprint, ip_address, user_agent, is_active, expires_at, created_at, last_accessed_at, department_id, location_info
                       FROM sessions WHERE ${whereClause}
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
}

module.exports = SessionRepository;
