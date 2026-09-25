const BaseRepository = require('../../repositories/baseRepository');

class DeviceRepository extends BaseRepository {
  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at
       FROM devices
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

    if (options.deviceType) {
      queryParams.push(options.deviceType.toUpperCase());
      const typeIndex = queryParams.length;
      whereConditions.push(`device_type = $${typeIndex}`);
    }

    if (options.isActive !== undefined) {
      queryParams.push(options.isActive);
      const activeIndex = queryParams.length;
      whereConditions.push(`is_active = $${activeIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM devices WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at
                       FROM devices WHERE ${whereClause}
                       ORDER BY last_seen_at DESC
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
      `INSERT INTO devices (id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW())
       RETURNING id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at`,
      [
        data.userId,
        data.deviceName,
        data.deviceType.toUpperCase(),
        data.deviceModel || null,
        data.osVersion || null,
        data.appVersion || null,
        data.pushToken || null,
        data.isActive || true,
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

    if (data.deviceName !== undefined) {
      setClauses.push(`device_name = $${paramIndex++}`);
      params.push(data.deviceName);
    }
    if (data.deviceType !== undefined) {
      setClauses.push(`device_type = $${paramIndex++}`);
      params.push(data.deviceType.toUpperCase());
    }
    if (data.deviceModel !== undefined) {
      setClauses.push(`device_model = $${paramIndex++}`);
      params.push(data.deviceModel);
    }
    if (data.osVersion !== undefined) {
      setClauses.push(`os_version = $${paramIndex++}`);
      params.push(data.osVersion);
    }
    if (data.appVersion !== undefined) {
      setClauses.push(`app_version = $${paramIndex++}`);
      params.push(data.appVersion);
    }
    if (data.pushToken !== undefined) {
      setClauses.push(`push_token = $${paramIndex++}`);
      params.push(data.pushToken);
    }
    if (data.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }

    if (setClauses.length === 0) return existing;

    params.push(id);
    const result = await runner.query(
      `UPDATE devices SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at`,
      params
    );
    return result.rows[0];
  }

  async deactivate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE devices SET is_active = false WHERE id = $1 RETURNING id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async toggleActive(id, newActiveState, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE devices SET is_active = $2, last_seen_at = NOW() WHERE id = $1 RETURNING id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at`,
      [id, newActiveState]
    );
    return result.rows[0] || null;
  }

  async updateLastSeen(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE devices SET last_seen_at = NOW() WHERE id = $1 RETURNING id, user_id, device_name, device_type, device_model, os_version, app_version, push_token, last_seen_at, is_active, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = DeviceRepository;
