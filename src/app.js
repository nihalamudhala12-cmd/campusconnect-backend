/**
 * CampusConnect Backend — Application Entry Point
 * Step 6.1 — Backend Foundation
 *
 * Creates the Express application, applies middleware, registers routes,
 * and sets up global error handling.
 *
 * Layer Dependency Flow:
 *   Config → App → Middleware → Routes → Controllers → Services → Repositories
 */

const express = require('express');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const { NotFoundError } = require('./errors');
const healthRouter = require('./routes/health');
const { routeIndex } = require('./routes');

// Initialize Express
const app = express();

// ---------------------------------------------------------------------------
// Middleware (order matters!)
// ---------------------------------------------------------------------------

// 1. CORS — allow frontend to communicate with the backend
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  const allowedOrigin = (config.app.corsOrigin && config.app.corsOrigin !== '*')
    ? config.app.corsOrigin
    : origin;

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 2. JSON body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// 3. Security headers for all responses
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Mount the health check router at /health
app.use('/health', healthRouter);

// Mount all registered application routes
app.use(routeIndex());

// ---------------------------------------------------------------------------
// 404 Handler — catch all unmatched routes and forward to errorHandler
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
});

// ---------------------------------------------------------------------------
// Global Error Handler (must be last middleware)
// ---------------------------------------------------------------------------

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
// Step 6.4 — Database Infrastructure: the HTTP listener is no longer
// invoked at module-load time. server.js now calls `startServer()`
// AFTER the database infrastructure has been initialized and verified.
// `app` is still exported so consumers that import it (e.g. tests) keep
// working unchanged.

const PORT = config.app.port;

/**
 * Start the HTTP server.
 * Called by server.js after the database infrastructure is initialized.
 *
 * @returns {import('http').Server}
 */
function startServer() {
  return app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log('\u{1F680} CampusConnect Backend v1.0.0 starting on port ' + PORT);
    // eslint-disable-next-line no-console
    console.log('   API Base URL: ' + config.app.apiBaseUrl);
    // eslint-disable-next-line no-console
    console.log('   Node Env: ' + config.app.nodeEnv);
  });
}

module.exports = { app, startServer }; // Allow testing with `node src/app.js`