const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');
const { ForbiddenError } = require('../../errors');

class NotificationRepository extends BaseRepository {
  async findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId, client = null) {
    const runner = this.getRunner(client);
    const params = [id];

    const { clause, join } = applyDepartmentScope('notifications', userDepartmentId, params, 'n');

    let query = `
      SELECT n.id, n.user_id, n.type, n.title, n.message, n.related_announcement_id, n.is_read, n.priority, n.created_at
      FROM notifications n
    `;

    if (join) {
      query += ` ${join}`;
    }

    query += ` WHERE n.id = $1 AND ${clause}`;

    const result = await runner.query(query, params);
    const notification = result.rows[0] || null;

    if (notification && userRole !== 'PRINCIPAL' && notification.user_id !== userId) {
      return null;
    }

    return notification;
  }

  async findAll(userId, userRole, userDepartmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [userId];
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereConditions = ['user_id = $1'];
    const queryParams = [...params];

    if (options.type) {
      queryParams.push(options.type.toUpperCase());
      const typeIndex = queryParams.length;
      whereConditions.push(`type = $${typeIndex}`);
    }

    if (options.isRead !== undefined) {
      const isReadValue = options.isRead === 'true' ? true : options.isRead === 'false' ? false : options.isRead;
      queryParams.push(isReadValue);
      const isReadIndex = queryParams.length;
      whereConditions.push(`is_read = $${isReadIndex}`);
    }

    const { clause, join } = applyDepartmentScope('notifications', userDepartmentId, queryParams, 'n');

    let whereClause = whereConditions.join(' AND ');

    if (userRole !== 'PRINCIPAL') {
      whereClause += ` AND (user_id = $${queryParams.length + 1})`;
      queryParams.push(userId);
    }

    whereClause += ` AND ${clause}`;

    const countQuery = `SELECT COUNT(*)::int as total FROM notifications n ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT n.id, n.user_id, n.type, n.title, n.message, n.related_announcement_id, n.is_read, n.priority, n.created_at
                       FROM notifications n ${join} WHERE ${whereClause}
                       ORDER BY n.is_read ASC, n.created_at DESC
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

  async findByUserId(targetUserId, requesterUserId, requesterRole, requesterDepartmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [targetUserId];
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereConditions = ['user_id = $1'];
    const queryParams = [...params];

    if (options.type) {
      queryParams.push(options.type.toUpperCase());
      const typeIndex = queryParams.length;
      whereConditions.push(`type = $${typeIndex}`);
    }

    if (options.isRead !== undefined) {
      const isReadValue = options.isRead === 'true' ? true : options.isRead === 'false' ? false : options.isRead;
      queryParams.push(isReadValue);
      const isReadIndex = queryParams.length;
      whereConditions.push(`is_read = $${isReadIndex}`);
    }

    const { clause, join } = applyDepartmentScope('notifications', requesterDepartmentId, queryParams, 'n');

    let whereClause = whereConditions.join(' AND ');

    if (requesterRole !== 'PRINCIPAL') {
      whereClause += ` AND (user_id = $${queryParams.length + 1})`;
      queryParams.push(targetUserId);
    }

    whereClause += ` AND ${clause}`;

    const countQuery = `SELECT COUNT(*)::int as total FROM notifications n ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT n.id, n.user_id, n.type, n.title, n.message, n.related_announcement_id, n.is_read, n.priority, n.created_at
                       FROM notifications n ${join} WHERE ${whereClause}
                       ORDER BY n.is_read ASC, n.created_at DESC
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
      `INSERT INTO notifications (id, user_id, type, title, message, related_announcement_id, is_read, priority)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, type, title, message, related_announcement_id, is_read, priority, created_at`,
      [
        data.userId,
        data.type.toUpperCase(),
        data.title,
        data.message,
        data.relatedAnnouncementId || null,
        data.isRead || false,
        data.priority || 'NORMAL',
      ]
    );
    return result.rows[0];
  }

  async updateWithDepartmentScope(id, data, userId, userRole, userDepartmentId, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId, client);
    if (!existing) return null;

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot update notification for another user');
    }

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    if (data.message !== undefined) {
      setClauses.push(`message = $${paramIndex++}`);
      params.push(data.message);
    }
    if (data.type !== undefined) {
      setClauses.push(`type = $${paramIndex++}`);
      params.push(data.type.toUpperCase());
    }
    if (data.isRead !== undefined) {
      setClauses.push(`is_read = $${paramIndex++}`);
      params.push(data.isRead);
    }
    if (data.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      params.push(data.priority.toUpperCase());
    }
    if (data.relatedAnnouncementId !== undefined) {
      setClauses.push(`related_announcement_id = $${paramIndex++}`);
      params.push(data.relatedAnnouncementId || null);
    }

    if (setClauses.length === 0) return existing;

    params.push(id);
    const result = await runner.query(
      `UPDATE notifications SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, user_id, type, title, message, related_announcement_id, is_read, priority, created_at`,
      params
    );
    return result.rows[0];
  }

  async markAsReadWithDepartmentScope(id, userId, userRole, userDepartmentId, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId, client);
    if (!existing) return null;

    if (existing.user_id !== userId && userRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Cannot mark notification for another user');
    }

    if (existing.is_read) {
      return existing;
    }

    const result = await runner.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 RETURNING id, user_id, type, title, message, related_announcement_id, is_read, priority, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async deleteWithDepartmentScope(id, userId, userRole, userDepartmentId, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId, client);
    if (!existing) return null;

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot delete notification for another user');
    }

    const result = await runner.query(
      `DELETE FROM notifications WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdAndUser(id, userId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, user_id, type, title, message, related_announcement_id, is_read, priority, created_at
       FROM notifications
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] || null;
  }
}

module.exports = NotificationRepository;
