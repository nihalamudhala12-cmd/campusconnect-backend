/**
 * Global Error Handler Middleware
 * Step 6.1 — Backend Foundation
 *
 * Catches all errors thrown in the request pipeline and formats them
 * into a standardized JSON response. Custom error types (from /errors)
 * map to specific HTTP status codes.
 *
 * Layer Dependency:
 *   errorHandler → errors/* (uses AppError and subclasses)
 */

const { AppError } = require('../errors');

/**
 * Express error handling middleware (4-arg signature required).
 *
 * @param {Error} err
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Default to a generic 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || (err.name !== 'Error' ? err.name : 'INTERNAL_SERVER_ERROR');
  let details = err.details || null;
  let errors = err.errors || undefined;

  // Custom AppError instances carry their own status and code
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || err.name;
  }

  const isExpectedTestError = process.env.NODE_ENV === 'test' && req.headers['x-expected-error'] === 'true';
  const shouldLog = !(isExpectedTestError && [401, 403, 409].includes(statusCode));
  if (shouldLog) {
    // Log for the server operator
    console.error(`[Error] ${req.method} ${req.path} → ${statusCode} ${code}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== null && details !== undefined && { details }),
      ...(errors && { errors }),
    },
  });
}

module.exports = {
  errorHandler,
};
