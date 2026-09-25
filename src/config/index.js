/**
 * Centralized Configuration
 * Step 6.1 — Backend Foundation
 *
 * Loads environment variables and provides typed access to application settings.
 * All layers import from here — no .env access outside this module.
 */

require('dotenv').config();

/**
 * Centralized Configuration
 * Step 6.1 — Backend Foundation
 * Step 6.3 — Database Preparation (extended database config only)
 *
 * Loads environment variables and provides typed access to application settings.
 * All layers import from here — no .env access outside this module.
 *
 * DATABASE CONFIGURATION STRATEGY (Step 6.3):
 *   - Single source of truth: DATABASE_URL environment variable
 *   - Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
 *   - Optional per-field overrides (DB_HOST, DB_PORT, etc.) used only if
 *     DATABASE_URL is absent
 *   - No credentials stored in source files
 *   - The `database` section below is configuration only — no connection is
 *     opened here. Connection lifecycle responsibility lives in the
 *     database infrastructure boundary (future step).
 */

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const toFloat = (value, fallback) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Parse a postgresql:// URL into structured fields.
 * Returns null if the URL is missing or malformed.
 * This parser handles standard postgresql:// scheme only.
 */
const parseDatabaseUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    // Only postgresql:// scheme is supported at this stage.
    if (!url.startsWith('postgresql://')) return null;
    const stripped = url.replace(/^postgresql:\/\//, '');
    const [userinfo, hostpart] = stripped.split('@');
    if (!hostpart) return null;
    const [user, password] = userinfo.split(':');
    const [hostport, database] = hostpart.split('/');
    if (!hostport) return null;
    const [host, portStr] = hostport.split(':');
    const port = toInt(portStr, 5432);
    return {
      user: user ? decodeURIComponent(user) : '',
      password: password ? decodeURIComponent(password) : '',
      host: host || 'localhost',
      port,
      database: database ? database.split('?')[0] : '',
    };
  } catch (_e) {
    return null;
  }
};

/**
 * Application settings derived from environment variables.
 * Access via: const config = require('./config');
 */
const parsedFromUrl = parseDatabaseUrl(process.env.DATABASE_URL);

const config = {
  app: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || null,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  get isJwtConfigured() {
    return !!this.security.jwtSecret;
  },

  // -------------------------------------------------------------------
  // Database configuration (Step 6.3 — Database Preparation)
  // -------------------------------------------------------------------
  // This block is configuration only. It does NOT open a connection.
  // Connection initialization, pool management, and shutdown belong
  // to the database infrastructure layer (future step).
  //
  // Priority: DATABASE_URL is the canonical source. DB_* variables
  // act as per-field overrides — if a DB_* variable is set (including
  // to an empty string), it always wins over the URL-parsed value.
  // If a DB_* variable is not set at all, the URL-parsed value is used.
  // If neither is available, the hard-coded default is used.
  database: {
    url: process.env.DATABASE_URL || null,
    isConfigured: !!process.env.DATABASE_URL,
    host: process.env.DB_HOST !== undefined
      ? process.env.DB_HOST
      : (parsedFromUrl ? parsedFromUrl.host : 'localhost'),
    port: toInt(process.env.DB_PORT, parsedFromUrl ? parsedFromUrl.port : 5432),
    database: process.env.DB_NAME !== undefined
      ? process.env.DB_NAME
      : (parsedFromUrl ? parsedFromUrl.database : 'campusconnect'),
    user: process.env.DB_USER !== undefined
      ? process.env.DB_USER
      : (parsedFromUrl ? parsedFromUrl.user : ''),
    password: process.env.DB_PASSWORD !== undefined
      ? process.env.DB_PASSWORD
      : (parsedFromUrl ? parsedFromUrl.password : ''),
    ssl: toBoolean(process.env.DB_SSL, false),
    pool: {
      max: toInt(process.env.DB_POOL_MAX, 10),
      idleTimeoutMillis: toInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 10000),
    },
  },

  // Feature flags for optional functionality.
  features: {
    healthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
    apiVersioning: process.env.ENABLE_API_VERSIONING === 'true',
  },

  // -------------------------------------------------------------------
  // AI configuration (local response engine; no external LLM provider)
  // -------------------------------------------------------------------
  // The AI assistant runs on a local response engine.
  // No external provider credentials are required.
  ai: {
    available: true,
    provider: 'local',
    configured: true,
  },

  // Derived helpers
  isDevelopment: () => process.env.NODE_ENV !== 'production',
  isProduction: () => process.env.NODE_ENV === 'production',
};

module.exports = config;
