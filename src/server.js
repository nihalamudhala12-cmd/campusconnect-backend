/**
 * CampusConnect Backend — Server Entry Point
 * Step 6.1 — Backend Foundation
 * Step 6.4 — Database Infrastructure (lifecycle orchestration)
 *
 * This file is the actual entry point referenced by package.json's
 * "main" and "start". It is the ONLY place where the database
 * infrastructure lifecycle is orchestrated:
 *
 *   1. Initialize PostgreSQL pool.
 *   2. Verify connectivity (schema-independent probe).
 *   3. Start the HTTP server (startServer()).
 *   4. Register signal handlers (SIGINT / SIGTERM) for graceful shutdown.
 *
 * Step 6.4 policy: FAIL-FAST on database unavailability. See plan.
 */

const connection = require('./infrastructure/database/connection');
const config = require('./config');

if (!config.isJwtConfigured) {
  console.error('[fatal] JWT_SECRET is not configured. Set JWT_SECRET environment variable before starting.');
  process.exit(1);
}

/**
 * Run the database infrastructure initialization. On failure, log a
 * controlled error and exit with a non-zero code so an orchestrator
 * can react.
 */
async function bootstrapDatabase() {
  try {
    await connection.initialize();
    await connection.verifyConnection();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[fatal] Database initialization failed: ${err.message}` +
        (err.details ? ` (${err.details})` : '')
    );
    process.exit(1);
  }
}

/**
 * Idempotent graceful shutdown. Called for SIGINT and SIGTERM.
 * Prevents duplicate execution, closes the HTTP server first (so no
 * new requests reach the database), then closes the pool.
 */
let shuttingDown = false;
async function gracefulShutdown(httpServer, signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  // eslint-disable-next-line no-console
  console.log(`\n[shutdown] Received ${signal}, draining...`);

  // 1. Stop accepting new HTTP connections.
  if (httpServer && httpServer.close) {
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
      // Force-exit if the server refuses to close promptly.
      setTimeout(resolve, 5000).unref();
    });
  }

  // 2. Close the PostgreSQL pool.
  try {
    await connection.close(5000);
    // eslint-disable-next-line no-console
    console.log('[shutdown] Complete');
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[shutdown] Error during shutdown: ${err.message}`);
    process.exit(1);
  }
}

(async () => {
  await bootstrapDatabase();

  // Defer Express require so app.js module-load side-effects do not
  // start the listener before the database is ready.
  const { startServer } = require('./app');
  const httpServer = startServer();

  // Single registration of signal handlers. Nodemon sends SIGTERM by
  // default; Ctrl+C sends SIGINT.
  const onSignal = (signal) => () => gracefulShutdown(httpServer, signal);
  process.on('SIGINT', onSignal('SIGINT'));
  process.on('SIGTERM', onSignal('SIGTERM'));
})();
