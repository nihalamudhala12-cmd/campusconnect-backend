const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');

class MessageRepository extends BaseRepository {
  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, sender_id, receiver_id, subject, body, is_read, created_at
       FROM messages
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdWithDepartmentScope(id, departmentId, client = null) {
    const runner = this.getRunner(client);
    let query;
    const params = [id];

    if (departmentId === 'ALL') {
      query = `SELECT m.id, m.sender_id, m.receiver_id, m.subject, m.body, m.is_read, m.created_at
               FROM messages m
               WHERE m.id = $1`;
    } else {
      query = `SELECT m.id, m.sender_id, m.receiver_id, m.subject, m.body, m.is_read, m.created_at
               FROM messages m
               WHERE m.id = $1
               AND (EXISTS (SELECT 1 FROM users u WHERE u.id = m.sender_id AND u.department_id = $2)
                 OR EXISTS (SELECT 1 FROM users u WHERE u.id = m.receiver_id AND u.department_id = $2))`;
      params.push(departmentId);
    }

    const result = await runner.query(query, params);
    return result.rows[0] || null;
  }

  async findAll(userId, departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const queryParams = [];

    // Build a single WHERE clause with correct parameter indices
    const conditions = [];

    if (departmentId !== 'ALL') {
      queryParams.push(departmentId);
      const deptIndex = queryParams.length;
      // Both sender and receiver must be checked against the same department param
      conditions.push(
        `(EXISTS (SELECT 1 FROM users u WHERE u.id = m.sender_id AND u.department_id = $${deptIndex})` +
        ` OR EXISTS (SELECT 1 FROM users u WHERE u.id = m.receiver_id AND u.department_id = $${deptIndex}))`
      );
    }

    queryParams.push(userId);
    const userIndex = queryParams.length;
    conditions.push(`(m.sender_id = $${userIndex} OR m.receiver_id = $${userIndex})`);

    if (options.senderId) {
      queryParams.push(options.senderId);
      const senderIndex = queryParams.length;
      conditions.push(`m.sender_id = $${senderIndex}`);
    }

    if (options.receiverId) {
      queryParams.push(options.receiverId);
      const receiverIndex = queryParams.length;
      conditions.push(`m.receiver_id = $${receiverIndex}`);
    }

    if (options.isRead !== undefined) {
      queryParams.push(options.isRead);
      const isReadIndex = queryParams.length;
      conditions.push(`m.is_read = $${isReadIndex}`);
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    const countQuery = `SELECT COUNT(*)::int as total FROM messages m WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT m.id, m.sender_id, m.receiver_id, m.subject, m.body, m.is_read, m.created_at
                       FROM messages m
                       WHERE ${whereClause}
                       ORDER BY m.created_at DESC
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
      `INSERT INTO messages (id, sender_id, receiver_id, subject, body)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING id, sender_id, receiver_id, subject, body, is_read, created_at`,
      [
        data.senderId,
        data.receiverId,
        data.subject || null,
        data.body,
      ]
    );
    return result.rows[0];
  }

  async update(id, data, client = null) {
    const runner = this.getRunner(client);

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (data.body !== undefined) {
      setClauses.push(`body = $${paramIndex++}`);
      params.push(data.body);
    }
    if (data.isRead !== undefined) {
      setClauses.push(`is_read = $${paramIndex++}`);
      params.push(data.isRead);
    }

    if (setClauses.length === 0) {
      return null;
    }

    params.push(id);
    const updateIndex = paramIndex;

    const result = await runner.query(
      `UPDATE messages SET ${setClauses.join(', ')} WHERE id = $${updateIndex}
       RETURNING id, sender_id, receiver_id, subject, body, is_read, created_at`,
      params
    );

    return result.rows[0] || null;
  }

  async delete(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `DELETE FROM messages WHERE id = $1
       RETURNING id, sender_id, receiver_id, subject, body, is_read, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = MessageRepository;