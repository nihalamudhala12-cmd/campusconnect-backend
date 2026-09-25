/**
 * PostgreSQL Infrastructure — Connection Lifecycle
 * Step 6.4 — Database Infrastructure Implementation
 *
 * PURPOSE
 *   Establishes a single, controlled PostgreSQL infrastructure boundary
 *   for the CampusConnect backend. Owns the entire connection lifecycle:
 *     - pool creation
 *     - connectivity verification
 *     - runtime access (pool export to the future repository layer)
 *     - graceful pool shutdown
 *
 * SCOPE (Step 6.4)
 *   - Create a single pg.Pool from the centralized database config.
 *   - Verify connectivity with a schema-independent probe (SELECT 1).
 *   - Provide controlled access to the pool for the repository layer.
 *   - Close the pool safely during graceful shutdown.
 *   - Translate driver-level failures into the existing error architecture.
 *
 * OUT OF SCOPE (Step 6.4)
 *   - No schema, tables, models, or migrations.
 *   - No application queries (SELECT/INSERT/UPDATE/DELETE on app data).
 *   - No concrete repositories, services, controllers, or APIs.
 *   - No authentication or authorization.
 *
 * LAYER DEPENDENCY
 *   connection.js  →  src/config/database.js   (read-only config access)
 *   connection.js  →  src/errors/*              (DatabaseError, ServiceUnavailableError)
 *   connection.js  →  pg (driver)
 *   server.js      →  connection.js             (lifecycle orchestration)
 *
 *   Routes, controllers, services, and repositories MUST NOT import this
 *   module directly. They receive the pool through dependency injection
 *   (see src/repositories/baseRepository.js).
 */

const { Pool } = require('pg');
const databaseConfig = require('../../config/database');
const {
  AppError,
  DatabaseError,
  ServiceUnavailableError,
} = require('../../errors');

/**
 * Internal state.
 * The pool is held in module scope so that the lifecycle is process-wide
 * and cannot be accidentally duplicated.
 */
let pool = null;
let initialized = false;
let closed = false;

/**
 * Build a pg.Pool configuration object from the centralized database
 * configuration. Only the fields the pg driver consumes are forwarded.
 */
function buildPoolConfig() {
  const cfg = databaseConfig.getConfig();
  return {
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
    max: cfg.pool.max,
    idleTimeoutMillis: cfg.pool.idleTimeoutMillis,
  };
}

/**
 * Produce a sanitized, non-sensitive description of the configured
 * database target. Safe to log. NEVER contains credentials or the
 * raw DATABASE_URL.
 */
function describeTarget() {
  const cfg = databaseConfig.getConfig();
  return `${cfg.user || '(no-user)'}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

/**
 * Map a pg-driver error into the existing application error architecture.
 *  - connection / refused / timeout / ENOTFOUND / ECONNREFUSED → ServiceUnavailableError
 *  - everything else                                          → DatabaseError
 *
 * The original error code is preserved on `details` for operator logs.
 * No raw pg error, password, or connection string is exposed through
 * the returned object's public message.
 */
function toInfrastructureError(err) {
  if (err instanceof AppError) return err;

  const code = err && err.code ? err.code : 'UNKNOWN';
  const opMsg = `[pg code: ${code}]`; // operator-side context only

  const connectionCodes = new Set([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
  ]);

  const isConnectionFailure =
    !err ||
    connectionCodes.has(code) ||
    /timeout|refused|ENOTFOUND|ETIMEDOUT|reach/i.test(err.message || '');

  if (isConnectionFailure) {
    return new ServiceUnavailableError(
      'Database service is unavailable',
      opMsg
    );
  }
  return new DatabaseError(err.message || 'Database operation failed', opMsg);
}

/**
 * Create the PostgreSQL connection pool. Idempotent.
 * Does NOT verify connectivity — call verifyConnection() afterwards.
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  if (initialized) return;
  if (closed) {
    throw new DatabaseError(
      'Database infrastructure has been closed and cannot be re-initialized'
    );
  }

  const cfg = databaseConfig.getConfig();
  if (!databaseConfig.isConfigured() && !cfg.user) {
    throw new ServiceUnavailableError(
      'Database is not configured (DATABASE_URL or DB_* variables required)'
    );
  }

  try {
    pool = new Pool(buildPoolConfig());

    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error(
        `[db] idle pool client error → ${toInfrastructureError(err).message}`
      );
    });

    initialized = true;
    // eslint-disable-next-line no-console
    console.log(`[db] PostgreSQL pool initialized for ${describeTarget()}`);
  } catch (err) {
    throw toInfrastructureError(err);
  }
}

/**
 * Verify that PostgreSQL is reachable using a schema-independent probe.
 * Uses `SELECT 1`, which requires no CampusConnect tables, no schema,
 * no application entities. This is an infrastructure-only check.
 *
 * @returns {Promise<void>} Resolves if reachable; throws
 *   ServiceUnavailableError otherwise.
 */
async function verifyConnection() {
  if (!pool) {
    throw new DatabaseError(
      'Database pool has not been initialized — call initialize() first'
    );
  }
  try {
    await pool.query('SELECT 1');
    // eslint-disable-next-line no-console
    console.log('[db] PostgreSQL connectivity verified');
  } catch (err) {
    throw toInfrastructureError(err);
  }
}

/**
 * Return the underlying pg.Pool for the repository layer.
 * Repositories receive this through dependency injection
 * (BaseRepository constructor) — they MUST NOT import this module.
 *
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (!pool) {
    throw new DatabaseError(
      'Database pool has not been initialized'
    );
  }
  return pool;
}

/**
 * Report whether the pool is currently initialized and ready for use.
 *
 * @returns {boolean}
 */
function isReady() {
  return initialized && pool !== null && !closed;
}

/**
 * Close the PostgreSQL pool. Idempotent — repeated calls are no-ops.
 * Safe to invoke from a graceful shutdown signal handler.
 *
 * @param {number} [timeoutMs=5000] Maximum time to wait for in-flight
 *   queries to finish before forcibly ending the pool.
 * @returns {Promise<void>}
 */
async function close(timeoutMs = 5000) {
  if (closed) return;
  closed = true;

  if (!pool) {
    // eslint-disable-next-line no-console
    console.log('[db] PostgreSQL pool close: nothing to close');
    return;
  }

  const poolRef = pool;
  pool = null;

  try {
    await Promise.race([
      poolRef.end(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('pool.end() timed out')),
          timeoutMs
        )
      ),
    ]);
    // eslint-disable-next-line no-console
    console.log('[db] PostgreSQL pool closed cleanly');
  } catch (err) {
    const wrapped = toInfrastructureError(err);
    // eslint-disable-next-line no-console
    console.error(`[db] Error during PostgreSQL pool shutdown → ${wrapped.message}`);
    throw wrapped;
  }
}

/**
 * Execute an async function within a PostgreSQL transaction block (BEGIN ... COMMIT / ROLLBACK).
 * Checks out a client from the pool, manages transaction state, and guarantees client release.
 *
 * @param {Function} fn Async callback receiving (client)
 * @returns {Promise<any>} Result returned by callback
 */
async function withTransaction(fn) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackErr) {
      // Ignore secondary rollback errors
    }
    throw toInfrastructureError(err);
  } finally {
    client.release();
  }
}

module.exports = {
  initialize,
  verifyConnection,
  getPool,
  isReady,
  close,
  withTransaction,
};