/**
 * Database Configuration Access Layer
 * Step 6.3 — Database Preparation
 *
 * PURPOSE
 *   Provides a clean read-only access surface for the database
 *   configuration block. This is the only place repositories and
 *   infrastructure code should obtain database settings.
 *
 * SCOPE (Step 6.3)
 *   - Exposes structured database configuration
 *   - Exposes whether a database URL has been provided
 *   - Documents the connection-lifecycle responsibility boundary
 *
 * OUT OF SCOPE (Step 6.3)
 *   - No connection initialization (no `connect()`)
 *   - No connection pool creation
 *   - No query execution
 *   - No ORM setup
 *   - No schema, models, or migrations
 *
 * FUTURE RESPONSIBILITY (Database Design step)
 *   The connection lifecycle (initialize / verify / disconnect) will
 *   live in a dedicated database infrastructure module (e.g.
 *   `src/infrastructure/database/connection.js`) and will be called
 *   from `server.js` during process startup and graceful shutdown.
 *   Repositories will receive a pool/client through dependency
 *   injection and will NOT import this module directly.
 */

const config = require('../config');

const database = {
  /**
   * Returns the raw DATABASE_URL (or null).
   * Provided for diagnostic/infrastructure use only.
   * Repositories MUST NOT parse this URL themselves.
   */
  getUrl: () => config.database.url,

  /**
   * Returns the structured database configuration object
   * (host, port, database, user, password, ssl, pool).
   */
  getConfig: () => ({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl,
    pool: { ...config.database.pool },
  }),

  /**
   * Returns whether a database URL has been configured.
   * Informational only — no connection is made by this module.
   */
  isConfigured: () => config.database.isConfigured,
};

module.exports = database;
