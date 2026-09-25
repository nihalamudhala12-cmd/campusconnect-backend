/**
 * Middleware Registry
 * Step 6.1 — Backend Foundation
 *
 * Centralized export point for all middleware.
 * Middleware in this directory applies cross-cutting concerns to all requests.
 */

const asyncHandler = require('./asyncHandler');
const { errorHandler } = require('./errorHandler');
const validateRequest = require('./validateRequest');
const { authenticate, optionalAuthenticate } = require('./authMiddleware');
const { authorize } = require('./rbacMiddleware');

module.exports = {
  asyncHandler,
  errorHandler,
  validateRequest,
  authenticate,
  optionalAuthenticate,
  authorize,
};