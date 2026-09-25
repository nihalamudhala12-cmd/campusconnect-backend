/**
 * Department Validators
 * M2 — Departments
 */
const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

function validateCreateDepartment(body) {
  const errors = [];
  if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required and must be a non-empty string' });
  } else if (body.name.trim().length > 150) {
    errors.push({ field: 'name', message: 'Name must not exceed 150 characters' });
  }
  if (!body || !body.code || typeof body.code !== 'string') {
    errors.push({ field: 'code', message: 'Code is required' });
  } else if (body.code.trim().length > 20) {
    errors.push({ field: 'code', message: 'Code must not exceed 20 characters' });
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateUpdateDepartment(body) {
  const errors = [];
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name must be a non-empty string' });
    } else if (body.name.trim().length > 150) {
      errors.push({ field: 'name', message: 'Name must not exceed 150 characters' });
    }
  }
  if (body.code !== undefined) {
    if (typeof body.code !== 'string' || body.code.trim().length === 0) {
      errors.push({ field: 'code', message: 'Code must be a non-empty string' });
    } else if (body.code.trim().length > 20) {
      errors.push({ field: 'code', message: 'Code must not exceed 20 characters' });
    }
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateListDepartmentsQuery(query) {
  const errors = [];
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (Number.isNaN(page) || page < 1) errors.push({ field: 'page', message: 'Page must be a positive integer' });
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 100) errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
  }
  if (query.status !== undefined && query.status !== '') {
    if (!VALID_STATUSES.includes(query.status.toUpperCase())) errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  return errors;
}

function validateDepartmentIdParam(params) {
  const errors = [];
  if (!params.id) {
    errors.push({ field: 'id', message: 'Department ID is required' });
    return errors;
  }
  if (!validateUUID(params.id) && !validateCode(params.id)) {
    errors.push({ field: 'id', message: 'Department ID must be a valid UUID or business code' });
  }
  return errors;
}

module.exports = {
  validateCreateDepartment,
  validateUpdateDepartment,
  validateListDepartmentsQuery,
  validateDepartmentIdParam,
};
