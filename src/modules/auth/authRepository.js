const BaseRepository = require('../../repositories/baseRepository');

class AuthRepository extends BaseRepository {
  async findById(id, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, email, role, department_id, status, password_hash, mfa_enabled, profile_completed, created_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdentifier(identifier, client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT id, name, email, role, department_id, status, password_hash, mfa_enabled, profile_completed, created_at
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [identifier]
    );
    return result.rows[0] || null;
  }
}

module.exports = AuthRepository;
