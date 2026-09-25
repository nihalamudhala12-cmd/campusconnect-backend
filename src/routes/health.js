/**
 * Health Check Route
 * Step 6.1 — Backend Foundation
 * Step 6.4 — Database-Aware Infrastructure Probe
 *
 * GET /health endpoint for monitoring service liveness and database connectivity.
 */

const express = require('express');
const router = express.Router();
const connection = require('../infrastructure/database/connection');

/**
 * GET /health
 * Returns 200 OK if service and database are operational.
 * Returns 503 Service Unavailable if database connection is down.
 */
router.get('/', async (_req, res) => {
  let dbStatus = 'disconnected';
  let dbHealthy = false;

  if (connection.isReady()) {
    try {
      const pool = connection.getPool();
      await pool.query('SELECT 1');
      dbStatus = 'connected';
      dbHealthy = true;
    } catch (_err) {
      dbStatus = 'error';
    }
  }

  const statusCode = dbHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: dbHealthy ? 'ok' : 'degraded',
    service: 'CampusConnect Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
    },
  });
});

module.exports = router;
