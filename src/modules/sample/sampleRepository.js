/**
 * Sample Repository
 * Step 6.7 — API Foundation Verification
 *
 * Demonstrates the Controller → Service → Repository flow.
 * Uses BaseRepository pattern with department scope and transaction support.
 */

const { BaseRepository } = require('../repositories');
const { applyDepartmentScope } = require('../repositories/departmentScope');

class SampleRepository extends BaseRepository {
  constructor(db) {
    super(db);
  }

  async findSample(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query('SELECT id, name, department_id, status FROM samples WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findSamplesByDepartment(departmentId, client = null) {
    const runner = this.getRunner(client);
    const params = [];
    const { clause, join } = applyDepartmentScope('departments', departmentId, params);
    const query = `SELECT id, name, department_id, status FROM samples ${join} WHERE ${clause}`;
    const result = await runner.query(query, params);
    return result.rows;
  }

  async createSample(data, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      'INSERT INTO samples (id, name, department_id, status) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id, name, department_id, status',
      [data.name, data.departmentId, data.status || 'ACTIVE']
    );
    return result.rows[0];
  }

  async updateSample(id, data, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      'UPDATE samples SET name = $1, status = $2 WHERE id = $3 RETURNING id, name, department_id, status',
      [data.name, data.status, id]
    );
    return result.rows[0] || null;
  }

  async deleteSample(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query('DELETE FROM samples WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
}

module.exports = SampleRepository;
