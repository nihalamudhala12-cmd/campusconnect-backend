/**
 * Custom Error Classes
 * Step 6.1 — Backend Foundation
 *
 * Provides structured error types that map to specific HTTP status codes.
 * Errors thrown with these classes will be caught by the global error handler
 * in middleware/errorHandler.js.
 *
 * Layer Dependency:
 *   errors/* → used by Controllers, Services, and Middleware
 *   errors/* MUST NOT depend on HTTP/Express concerns.
 *
 * Usage (future step):
 *   throw new NotFoundError('User not found');
 *   throw new ValidationError('Email is required');
 */

class AppError extends Error {
  constructor(message, statusCode = 500, details = null, code = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.code = code || this.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, details, 'BAD_REQUEST');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, details, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, details, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not Found', details = null) {
    super(message, 404, details, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, details, 'CONFLICT');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation Error', errors = []) {
    super(message, 422, null, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

/**
 * DatabaseError (Step 6.3)
 *
 * Represents an internal database operation failure (query failure,
 * constraint violation, unexpected data-access error). Mapped to 500.
 *
 * Used by the future database infrastructure / repository layer to
 * surface failures to the existing error pipeline without coupling
 * to any specific driver error type.
 */
class DatabaseError extends AppError {
  constructor(message = 'Database Error', details) {
    super(message, 500);
    this.details = details;
  }
}

/**
 * ServiceUnavailableError (Step 6.3)
 *
 * Represents a database connectivity failure: the database is
 * unreachable, the connection pool cannot be created, or a required
 * service dependency is not available. Mapped to 503.
 *
 * Used by the future database infrastructure layer during
 * initialization or runtime connectivity checks.
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable', details) {
    super(message, 503);
    this.details = details;
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  DatabaseError,
  ServiceUnavailableError,
};