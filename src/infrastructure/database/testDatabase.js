/**
 * Test Database Isolation Harness
 *
 * PURPOSE
 *   Guarantee that automated tests can never write to, or destroy data in,
 *   a non-test PostgreSQL database (in particular the development database
 *   `campusconnect`).
 *
 * DESIGN
 *   Three complementary mechanisms:
 *
 *   1. REDIRECTION (useTestDatabase)
 *      Must be invoked as the FIRST statement of a destructive test module,
 *      before anything requires `src/config`. The config layer resolves
 *      `DB_NAME` with priority over `DATABASE_URL`, so setting `DB_NAME`
 *      re-points every subsequent connection at the test database.
 *
 *   2. NAME VALIDATION
 *      A test database is only honoured if its name matches
 *      /^campusconnect_test$/, i.e. the `campusconnect_test` convention.
 *      Any other name is rejected outright, so a stray
 *      `TEST_DB_NAME=campusconnect` cannot re-enable the old behaviour.
 *
 *   3. RUNTIME ASSERTION (assertTestDatabase)
 *      Immediately before a destructive statement the caller verifies via
 *      `current_database()` that the live connection really is the test
 *      database. This catches the case where the pool was constructed
 *      before redirection, or an environment override slipped through.
 *
 * USAGE
 *   // top of a destructive test file, before any other require
 *   const testDatabase = require('./infrastructure/database/testDatabase');
 *   testDatabase.useTestDatabase();
 *
 *   // inside setup, before touching data
 *   await testDatabase.ensureTestDatabase();
 *   await testDatabase.assertTestDatabase(connection.getPool());
 */

/** The only database name destructive tests are ever permitted to touch. */
const TEST_DATABASE_NAME = 'campusconnect_test';

/**
 * Names that must never be used as a test target, even if an environment
 * variable attempts to select them.
 */
const PROTECTED_DATABASES = new Set([
  'campusconnect',
  'postgres',
  'template0',
  'template1',
]);

/** Application tables whose presence proves the schema has been applied. */
const SCHEMA_PROBE_TABLE = 'users';

let activated = false;

/**
 * Point this process at the dedicated test database.
 *
 * MUST run before `src/config` is first required by this process, because
 * the config layer snapshots process.env at load time and caches it. This
 * therefore executes at module load, as an IIFE placed above every other
 * require in this file. The named export is retained so callers can assert
 * the redirect explicitly, but it is idempotent and safe to call again.
 *
 * @returns {string} the test database name in effect
 * @throws {Error} if the requested name is not the sanctioned test database
 */
function useTestDatabase() {
  const requested = (process.env.TEST_DB_NAME || TEST_DATABASE_NAME).trim();

  if (requested !== TEST_DATABASE_NAME) {
    throw new Error(
      `[testDatabase] Refusing to run destructive tests against "${requested}". ` +
        `Only "${TEST_DATABASE_NAME}" is permitted. ` +
        'Unset TEST_DB_NAME to use the default.'
    );
  }

  if (PROTECTED_DATABASES.has(requested)) {
    throw new Error(
      `[testDatabase] "${requested}" is a protected database and must never be a test target.`
    );
  }

  // DB_NAME takes precedence over DATABASE_URL in src/config.
  process.env.DB_NAME = requested;

  if (!activated) {
    // eslint-disable-next-line no-console
    console.log(`[testDatabase] destructive tests redirected to database "${requested}"`);
    activated = true;
  }

  return requested;
}

// MUST precede the requires below: config is cached on first load.
useTestDatabase();

const { Pool } = require('pg');
const databaseConfig = require('../../config/database');

/**
 * Create the test database if absent and apply the schema.
 *
 * Idempotent. Presence of the schema is determined by inspecting
 * information_schema for real tables, NOT by the `_migrations` ledger,
 * because some suites historically truncate that ledger. A database that
 * already has tables is left completely alone.
 *
 * @returns {Promise<string>} the test database name
 */
async function ensureTestDatabase() {
  const name = useTestDatabase();
  const cfg = databaseConfig.getConfig();

  // Connect to the maintenance database to check for / create the target.
  const adminPool = new Pool({
    host: cfg.host,
    port: cfg.port,
    database: 'postgres',
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (exists.rowCount === 0) {
      // Identifier cannot be parameterised; the name is a fixed constant
      // that has already been validated against TEST_DATABASE_NAME.
      await adminPool.query(`CREATE DATABASE "${name}"`);
      // eslint-disable-next-line no-console
      console.log(`[testDatabase] created database "${name}"`);
    }
  } finally {
    await adminPool.end();
  }

  if (await schemaPresent(name, cfg)) {
    // eslint-disable-next-line no-console
    console.log(`[testDatabase] schema already present in "${name}" — skipping migrations`);
    return name;
  }

  // eslint-disable-next-line no-console
  console.log(`[testDatabase] applying schema to "${name}"`);
  const runner = require('./migrations/runner');
  await runner.runMigrations({ dryRun: false });

  if (!(await schemaPresent(name, cfg))) {
    throw new Error(
      `[testDatabase] Schema is still absent in "${name}" after running migrations.`
    );
  }

  return name;
}

/**
 * Probe whether a database already carries the CampusConnect schema.
 *
 * @param {string} name
 * @param {object} cfg structured database config
 * @returns {Promise<boolean>}
 */
async function schemaPresent(name, cfg) {
  const probePool = new Pool({
    host: cfg.host,
    port: cfg.port,
    database: name,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const r = await probePool.query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1`,
      [SCHEMA_PROBE_TABLE]
    );
    return r.rowCount > 0;
  } catch (_e) {
    return false;
  } finally {
    await probePool.end();
  }
}

/**
 * Assert that a live connection is pointed at the test database.
 *
 * Call this immediately before any destructive statement so that a
 * misconfigured environment fails loudly instead of wiping real data.
 *
 * @param {{query: Function}} queryable a pg Pool or Client
 * @returns {Promise<string>} the confirmed database name
 * @throws {Error} if the connection is not on the test database
 */
async function assertTestDatabase(queryable) {
  if (!queryable || typeof queryable.query !== 'function') {
    throw new Error('[testDatabase] assertTestDatabase requires a pg Pool or Client.');
  }
  const r = await queryable.query('SELECT current_database() AS n');
  const actual = r.rows[0].n;

  if (actual !== TEST_DATABASE_NAME) {
    throw new Error(
      `[testDatabase] BLOCKED: destructive statement refused. ` +
        `Connected database is "${actual}", expected "${TEST_DATABASE_NAME}".`
    );
  }
  return actual;
}

// CLI: `npm run db:test:setup` — creates and migrates the test database.
if (require.main === module) {
  ensureTestDatabase()
    .then((n) => {
      // eslint-disable-next-line no-console
      console.log(`[testDatabase] test database "${n}" is ready`);
      process.exit(0);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[testDatabase] setup failed: ${e.message}`);
      process.exit(1);
    });
}

module.exports = {
  TEST_DATABASE_NAME,
  PROTECTED_DATABASES,
  useTestDatabase,
  ensureTestDatabase,
  assertTestDatabase,
};
