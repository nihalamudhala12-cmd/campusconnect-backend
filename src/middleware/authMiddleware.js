/**
 * Authentication & Request Context Middleware
 * Step 6.1 — Backend Foundation
 *
 * Establishes request context (req.user) and fail-closed authentication middleware.
 * Supports token extraction and development context headers (X-User-Id, X-User-Role, etc.).
 *
 * Layer Dependency:
 *   authMiddleware → errors/* (UnauthorizedError)
 *   authMiddleware → config (jwtSecret, isDevelopment)
 */

const config = require('../config');
const { UnauthorizedError } = require('../errors');
const jwt = require('jsonwebtoken');
const connection = require('../infrastructure/database/connection');

function verifyJwtToken(token) {
  const secret = config.security.jwtSecret;
  if (!secret) {
    throw new UnauthorizedError('JWT secret is not configured');
  }
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  });
  if (!decoded || !decoded.role) {
    throw new UnauthorizedError('Invalid token payload');
  }
  return decoded;
}

async function validateUserSession(userId) {
  const pool = connection.getPool();
  const result = await pool.query(
    'SELECT id, role, department_id, status FROM users WHERE id = $1',
    [userId]
  );

  if (result.rowCount === 0) {
    throw new UnauthorizedError('User not found');
  }

  const user = result.rows[0];

  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('User account is not active');
  }

  return {
    id: user.id,
    role: user.role,
    departmentId: user.department_id,
    status: user.status,
  };
}

function extractUserContext(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const payload = verifyJwtToken(token);
        return {
          id: payload.id || payload.sub || 'usr_unknown',
          role: payload.role,
          departmentId: payload.departmentId || payload.deptId || null,
          email: payload.email || null,
        };
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          throw err;
        }
      }
    }
  }

  if (config.isDevelopment() || process.env.NODE_ENV === 'test') {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    const userDept = req.headers['x-user-dept'] || req.headers['x-user-department-id'];
    const userEmail = req.headers['x-user-email'];

    if (userId && userRole) {
      return {
        id: userId || 'usr_dev',
        role: userRole.toUpperCase(),
        departmentId: userDept || null,
        email: userEmail || null,
      };
    }
  }

  return null;
}

/**
 * Strict Authentication Middleware (FAIL-CLOSED).
 * Requires a valid authenticated user context on req.user.
 * Validates the user against the database to ensure account is active.
 */
async function authenticate(req, _res, next) {
  const user = extractUserContext(req);
  if (!user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  // Validate user session against database (for JWT tokens)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    try {
      const validatedUser = await validateUserSession(user.id);
      // Update user context with latest database state
      user.role = validatedUser.role;
      user.departmentId = validatedUser.departmentId;
      user.status = validatedUser.status;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return next(err);
      }
      // Fail closed: database validation failure cannot be bypassed with JWT data
      console.error('[authMiddleware] Database validation error:', err.message);
      return next(new UnauthorizedError('Session validation failed'));
    }
  }
  
  req.user = user;
  next();
}

/**
 * Optional Authentication Middleware.
 * Populates req.user if credentials are present, but does not block requests if absent.
 */
async function optionalAuthenticate(req, _res, next) {
  const user = extractUserContext(req);
  if (user) {
    // Validate user session against database (for JWT tokens)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      try {
        const validatedUser = await validateUserSession(user.id);
        if (validatedUser) {
          // Update user context with latest database state
          user.role = validatedUser.role;
          user.departmentId = validatedUser.departmentId;
          user.status = validatedUser.status;
          req.user = user;
          return next();
        }
        req.user = null;
        return next();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          req.user = null;
          return next();
        }
        // Fail closed: database validation failure cannot be bypassed with JWT data
        return next(new UnauthorizedError('Session validation failed'));
      }
    }
    req.user = user;
  }
  next();
}

module.exports = {
  extractUserContext,
  authenticate,
  optionalAuthenticate,
};
