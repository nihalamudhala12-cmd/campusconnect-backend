/**
 * Database Migration Runner
 * Step 6.5 — Database Design
 *
 * Executes all migrations in the correct order.
 * Uses the official pg driver.
 * Supports dry-run mode for verification.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load database config
const databaseConfig = require('../../../config/database');
const migrationOrder = require('./000_migration_order');

/**
 * Build pg.Pool configuration for migration runner
 * Note: This uses a separate pool with conservative settings for migrations
 * to avoid conflicts with the main application pool
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
    max: 1, // Single connection for sequential migrations
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

/**
 * Read SQL file contents
 */
function readSqlFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Run migrations
 */
async function runMigrations(options = {}) {
  const { dryRun = false, targetDir = __dirname } = options;

  const pool = new Pool(buildPoolConfig());
  const client = await pool.connect();

  try {
    console.log('[migrations] Starting migration run...');
    console.log('[migrations] Dry run:', dryRun ? 'YES' : 'NO');

    // Create migrations tracking table if not exists
    if (!dryRun) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Get already executed migrations
    const executed = new Set();
    if (!dryRun) {
      const result = await client.query('SELECT name FROM _migrations');
      result.rows.forEach(row => executed.add(row.name));
    }

    // Execute migrations in order
    for (const migrationFile of migrationOrder.migrations) {
      const filePath = path.join(targetDir, migrationFile);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${migrationFile}`);
      }

      if (executed.has(migrationFile)) {
        console.log(`[migrations] SKIP  ${migrationFile} (already executed)`);
        continue;
      }

      console.log(`[migrations] EXEC  ${migrationFile}`);

      if (!dryRun) {
        const sql = readSqlFile(filePath);
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO _migrations (name) VALUES ($1)',
            [migrationFile]
          );
          await client.query('COMMIT');
          console.log(`[migrations] OK    ${migrationFile}`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    }

    // Execute post-migration if specified
    if (migrationOrder.postMigration) {
      const postFile = path.join(targetDir, migrationOrder.postMigration);

      if (fs.existsSync(postFile)) {
        // Skip if already executed
        if (executed.has(migrationOrder.postMigration)) {
          console.log(`[migrations] SKIP  ${migrationOrder.postMigration} (already executed)`);
        } else {
          console.log(`[migrations] EXEC  ${migrationOrder.postMigration}`);

          if (!dryRun) {
            const sql = readSqlFile(postFile);
            await client.query('BEGIN');
            try {
              await client.query(sql);
              await client.query(
                'INSERT INTO _migrations (name) VALUES ($1)',
                [migrationOrder.postMigration]
              );
              await client.query('COMMIT');
              console.log(`[migrations] OK    ${migrationOrder.postMigration}`);
            } catch (err) {
              await client.query('ROLLBACK');
              throw err;
            }
          }
        }
      }
    }

    // Execute constraint migrations if specified (e.g., Issue #7 unique constraints)
    if (migrationOrder.constraintMigrations && migrationOrder.constraintMigrations.length > 0) {
      for (const constraintFile of migrationOrder.constraintMigrations) {
        const constraintPath = path.join(targetDir, constraintFile);

        if (!fs.existsSync(constraintPath)) {
          throw new Error(`Constraint migration file not found: ${constraintFile}`);
        }

        if (executed.has(constraintFile)) {
          console.log(`[migrations] SKIP  ${constraintFile} (already executed)`);
          continue;
        }

        console.log(`[migrations] EXEC  ${constraintFile}`);

        if (!dryRun) {
          const sql = readSqlFile(constraintPath);
          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query(
              'INSERT INTO _migrations (name) VALUES ($1)',
              [constraintFile]
            );
            await client.query('COMMIT');
            console.log(`[migrations] OK    ${constraintFile}`);
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          }
        }
      }
    }

    console.log('[migrations] All migrations completed successfully');
    return { success: true };

  } catch (err) {
    console.error('[migrations] ERROR:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Verify migrations (dry run)
 */
async function verifyMigrations(options = {}) {
  return runMigrations({ ...options, dryRun: true });
}

/**
 * Rollback last migration (simple implementation)
 */
async function rollbackLast(options = {}) {
  const { targetDir = __dirname } = options;

  const pool = new Pool(buildPoolConfig());
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT name FROM _migrations ORDER BY id DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      console.log('[migrations] No migrations to rollback');
      await client.query('COMMIT');
      return;
    }

    const lastMigration = result.rows[0].name;
    console.log(`[migrations] Rolling back: ${lastMigration}`);

    // Note: This only removes the migration record.
    // Actual rollback would require specific SQL per migration.
    await client.query(
      'DELETE FROM _migrations WHERE name = $1',
      [lastMigration]
    );

    await client.query('COMMIT');
    console.log('[migrations] Rollback complete');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrations] Rollback error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'up') {
    runMigrations({ dryRun: false })
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (args[0] === 'verify') {
    verifyMigrations()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (args[0] === 'down') {
    rollbackLast()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log('Usage: node runner.js [up|verify|down]');
    process.exit(1);
  }
}

module.exports = {
  runMigrations,
  verifyMigrations,
  rollbackLast
};
