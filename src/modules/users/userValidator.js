/**
 * User Validators
 * Step 6.7 — API Module 1: Users
 *
 * Validation schemas for Users module requests.
 */

const { BadRequestError } = require('../../errors');
const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_ROLES = ['PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'PARENT'];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

function validateCreateUser(body) {
  const errors = [];

  if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required and must be a non-empty string' });
  } else if (body.name.trim().length > 150) {
    errors.push({ field: 'name', message: 'Name must not exceed 150 characters' });
  }

  if (!body || !body.email || typeof body.email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push({ field: 'email', message: 'Email format is invalid' });
  }

  if (!body || !body.role) {
    errors.push({ field: 'role', message: 'Role is required' });
  } else if (!VALID_ROLES.includes(body.role.toUpperCase())) {
    errors.push({ field: 'role', message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  if (body.departmentId !== undefined && body.departmentId !== null && body.departmentId !== '') {
    if (!validateUUID(body.departmentId) && !validateCode(body.departmentId)) {
      errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  return errors;
}

function validateUpdateUser(body) {
  const errors = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name must be a non-empty string' });
    } else if (body.name.trim().length > 150) {
      errors.push({ field: 'name', message: 'Name must not exceed 150 characters' });
    }
  }

  if (body.email !== undefined) {
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push({ field: 'email', message: 'Email format is invalid' });
    }
  }

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role.toUpperCase())) {
      errors.push({ field: 'role', message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }
  }

  if (body.departmentId !== undefined && body.departmentId !== null && body.departmentId !== '') {
    if (!validateUUID(body.departmentId) && !validateCode(body.departmentId)) {
      errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  return errors;
}

function validateListUsersQuery(query) {
  const errors = [];

  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (Number.isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }
  }

  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'Limit must be a positive integer between 1 and 100' });
    }
  }

  if (query.role !== undefined && query.role !== '') {
    if (!VALID_ROLES.includes(query.role.toUpperCase())) {
      errors.push({ field: 'role', message: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }
  }

  if (query.status !== undefined && query.status !== '') {
    if (!VALID_STATUSES.includes(query.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  return errors;
}

function validateUserIdParam(params) {
  const errors = [];

  if (!params.id) {
    errors.push({ field: 'id', message: 'User ID is required' });
    return errors;
  }

  if (!validateUUID(params.id) && !validateCode(params.id)) {
    errors.push({ field: 'id', message: 'User ID must be a valid UUID or business code' });
  }

  return errors;
}

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateListUsersQuery,
  validateUserIdParam,
};
