/**
 * Announcement Repository
 * M8 — Announcements API
 *
 * Concrete repository for announcements table.
 * Uses BaseRepository with department scope and transaction support.
 */
const BaseRepository = require('../../repositories/baseRepository');
const { applyDepartmentScope } = require('../../repositories/departmentScope');

class AnnouncementRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at
       FROM announcements
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('announcements', departmentId, params);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = [clause];
    const queryParams = [...params];

    // ALL audience announcements are visible to everyone
    whereConditions.push(`audience = 'ALL' OR ${clause}`);

    if (options.audience) {
      queryParams.push(options.audience.toUpperCase());
      const audienceIndex = queryParams.length;
      whereConditions.push(`audience = $${audienceIndex}`);
    }

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`status = $${statusIndex}`);
    }

    if (options.type) {
      queryParams.push(options.type.toUpperCase());
      const typeIndex = queryParams.length;
      whereConditions.push(`type = $${typeIndex}`);
    }

    if (options.priority) {
      queryParams.push(options.priority.toUpperCase());
      const priorityIndex = queryParams.length;
      whereConditions.push(`priority = $${priorityIndex}`);
    }

    if (options.search) {
      queryParams.push(`%${options.search.toLowerCase()}%`);
      const searchIndex = queryParams.length;
      whereConditions.push(`(LOWER(title) LIKE $${searchIndex} OR LOWER(content) LIKE $${searchIndex})`);
    }

    if (options.createdBy) {
      queryParams.push(options.createdBy);
      const createdByIndex = queryParams.length;
      whereConditions.push(`created_by = $${createdByIndex}`);
    }

    if (options.departmentId) {
      queryParams.push(options.departmentId);
      const deptIndex = queryParams.length;
      whereConditions.push(`department_id = $${deptIndex}`);
    }

    if (options.publishBefore) {
      queryParams.push(options.publishBefore);
      const publishIndex = queryParams.length;
      whereConditions.push(`publish_at <= $${publishIndex}`);
    }

    if (options.publishAfter) {
      queryParams.push(options.publishAfter);
      const publishIndex = queryParams.length;
      whereConditions.push(`publish_at >= $${publishIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM announcements ${join} WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at
                        FROM announcements ${join} WHERE ${whereClause}
                        ORDER BY created_at DESC
                        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findByDepartment(departmentId, options = {}, client = null) {
    const runner = this.getRunner(client);
    const params = [departmentId];

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = ['department_id = $1'];
    const queryParams = [departmentId];

    // ALL audience announcements are visible to everyone
    whereConditions.push(`audience = 'ALL' OR department_id = $1`);

    if (options.audience) {
      queryParams.push(options.audience.toUpperCase());
      const audienceIndex = queryParams.length;
      whereConditions.push(`audience = $${audienceIndex}`);
    }

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`status = $${statusIndex}`);
    }

    if (options.type) {
      queryParams.push(options.type.toUpperCase());
      const typeIndex = queryParams.length;
      whereConditions.push(`type = $${typeIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM announcements WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at
                        FROM announcements WHERE ${whereClause}
                        ORDER BY created_at DESC
                        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findInstitutionWide(options = {}, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereConditions = ["audience = 'ALL'"];
    const queryParams = [];

    if (options.status) {
      queryParams.push(options.status.toUpperCase());
      const statusIndex = queryParams.length;
      whereConditions.push(`status = $${statusIndex}`);
    }

    if (options.type) {
      queryParams.push(options.type.toUpperCase());
      const typeIndex = queryParams.length;
      whereConditions.push(`type = $${typeIndex}`);
    }

    if (options.priority) {
      queryParams.push(options.priority.toUpperCase());
      const priorityIndex = queryParams.length;
      whereConditions.push(`priority = $${priorityIndex}`);
    }

    const whereClause = whereConditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int as total FROM announcements WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at
                        FROM announcements WHERE ${whereClause}
                        ORDER BY created_at DESC
                        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async create(data, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `INSERT INTO announcements (id, title, content, type, created_by, department_id, audience, status, priority, publish_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at`,
      [
        data.title,
        data.content,
        data.type || 'ANNOUNCEMENT',
        data.createdBy,
        data.departmentId || null,
        data.audience || 'DEPARTMENT',
        data.status || 'ACTIVE',
        data.priority || 'NORMAL',
        data.publishAt || null,
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
    let idx = 1;

    if (data.title !== undefined) { setClauses.push(`title = $${idx++}`); params.push(data.title); }
    if (data.content !== undefined) { setClauses.push(`content = $${idx++}`); params.push(data.content); }
    if (data.type !== undefined) { setClauses.push(`type = $${idx++}`); params.push(data.type); }
    if (data.departmentId !== undefined) { setClauses.push(`department_id = $${idx++}`); params.push(data.departmentId); }
    if (data.audience !== undefined) { setClauses.push(`audience = $${idx++}`); params.push(data.audience); }
    if (data.status !== undefined) { setClauses.push(`status = $${idx++}`); params.push(data.status); }
    if (data.priority !== undefined) { setClauses.push(`priority = $${idx++}`); params.push(data.priority); }
    if (data.publishAt !== undefined) { setClauses.push(`publish_at = $${idx++}`); params.push(data.publishAt); }

    if (setClauses.length === 0) return existing;

    params.push(id);
    const result = await runner.query(
      `UPDATE announcements SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at`,
      params
    );
    return result.rows[0];
  }

  async updateStatus(id, status, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE announcements SET status = $1 WHERE id = $2 RETURNING id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at`,
      [status.toUpperCase(), id]
    );
    return result.rows[0] || null;
  }

  async updateAudience(id, audience, departmentId, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE announcements SET audience = $1, department_id = $2 WHERE id = $3 RETURNING id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at`,
      [audience.toUpperCase(), departmentId || null, id]
    );
    return result.rows[0] || null;
  }

  async deactivate(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `UPDATE announcements SET status = 'INACTIVE' WHERE id = $1 RETURNING id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at`,
      [id]
    );
    return result.rows[0] || null;
  }

  async delete(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `DELETE FROM announcements WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByCreator(createdBy, options = {}, client = null) {
    return this.findAll('ALL', { ...options, createdBy }, client);
  }

  async findPendingAuthorization(options = {}, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const whereClause = "audience = 'PENDING_INSTITUTION_WIDE'";
    const queryParams = [];

    const countQuery = `SELECT COUNT(*)::int as total FROM announcements WHERE ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT id, title, content, type, created_by, department_id, audience, status, priority, publish_at, created_at
                        FROM announcements WHERE ${whereClause}
                        ORDER BY created_at DESC
                        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

module.exports = AnnouncementRepository;