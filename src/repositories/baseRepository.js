/**
 * Base Repository (Abstraction Only)
 * Step 6.1 — Backend Foundation
 * Step 6.3 — Database Preparation (integration boundary documentation)
 *
 * Abstract base class for all repositories.
 * Repositories abstract data access from the rest of the application.
 *
 * **STEP 6.1 SCOPE:** This is an interface definition only.
 * **STEP 6.3 SCOPE:** Integration boundary with the future database
 *                      infrastructure is documented below. No actual
 *                      data source is connected, no database, no ORM.
 *
 * Layer Dependency:
 *   Repositories → Future Database Infrastructure (downward, not yet
 *   implemented)
 *   Repositories MUST NOT contain business logic (that belongs to services).
 *
 * Step 6.3 — Repository Integration Boundary
 * -------------------------------------------------
 * When the database infrastructure is implemented (Database Design
 * step), concrete repositories will receive a database client/pool
 * through their constructor (dependency injection). The base class
 * here stores that client as `this.db` so subclasses can use it
 * without re-importing the database module.
 *
 *   Example (future step):
 *     class UserRepository extends BaseRepository {
 *       constructor(db) { super(db); }
 *       async findById(id) { return this.db.query(...); }
 *     }
 *
 * Repositories MUST:
 *   - Accept the database client through the constructor
 *   - Translate database driver errors into `DatabaseError` (500) or
 *     `ServiceUnavailableError` (503) from `../errors` so the global
 *     error handler can format them
 *   - Stay the ONLY data-access layer in the application
 *
 * Repositories MUST NOT:
 *   - Open, close, or manage connection lifecycles
 *   - Import the database configuration module directly
 *   - Contain business logic
 *   - Be imported by routes or controllers (only by services)
 *
 * Usage (future step):
 *   class UserRepository extends BaseRepository {
 *     async findById(id) { ... }
 *     async create(data) { ... }
 *   }
 */

class BaseRepository {
  /**
   * @param {object} [db] - Database client/pool. Optional in Step 6.3
   *   because no concrete repository exists yet. When the database
   *   infrastructure is implemented, concrete repositories will pass
   *   the client here via `super(db)`.
   */
  constructor(db = null) {
    if (this.constructor === BaseRepository) {
      throw new Error('BaseRepository is abstract and cannot be instantiated directly.');
    }
    this.db = db;
  }

  /**
   * Helper to obtain the active database query runner.
   * Uses the provided transaction client (if present), or falls back to this.db.
   *
   * @param {object} [client] Optional pg.PoolClient transaction client
   * @returns {object} Active database runner (pool or client)
   */
  getRunner(client = null) {
    return client || this.db;
  }

  // Stub methods — to be implemented in concrete repositories.
  // Defining them here documents the expected interface with optional transaction client support.
  async findById(_id, _client = null) {
    throw new Error('findById must be implemented in a concrete repository');
  }

  async findAll(_options = {}, _client = null) {
    throw new Error('findAll must be implemented in a concrete repository');
  }

  async create(_data, _client = null) {
    throw new Error('create must be implemented in a concrete repository');
  }

  async update(_id, _data, _client = null) {
    throw new Error('update must be implemented in a concrete repository');
  }

  async delete(_id, _client = null) {
    throw new Error('delete must be implemented in a concrete repository');
  }
}

module.exports = BaseRepository;
