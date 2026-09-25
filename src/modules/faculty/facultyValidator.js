/**
 * Faculty Validators
 * M4 — Faculty
 */

const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

function validateCreateFaculty(body) {
  const errors = [];
  if (!body || typeof body.userId !== 'string' || body.userId.trim().length === 0) {
    errors.push({ field: 'userId', message: 'User ID is required' });
  } else if (!validateUUID(body.userId) && !validateCode(body.userId)) {
    errors.push({ field: 'userId', message: 'User ID must be a valid UUID or business code' });
  }
  if (body.employeeId !== undefined && body.employeeId !== null && body.employeeId !== '') {
    if (typeof body.employeeId !== 'string' || body.employeeId.trim().length > 50) {
      errors.push({ field: 'employeeId', message: 'Employee ID must not exceed 50 characters' });
    }
  }
  if (body.designation !== undefined && body.designation !== null && body.designation !== '') {
    if (typeof body.designation !== 'string' || body.designation.trim().length > 100) {
      errors.push({ field: 'designation', message: 'Designation must not exceed 100 characters' });
    }
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateUpdateFaculty(body) {
  const errors = [];
  if (body.employeeId !== undefined && body.employeeId !== null && body.employeeId !== '') {
    if (typeof body.employeeId !== 'string' || body.employeeId.trim().length > 50) {
      errors.push({ field: 'employeeId', message: 'Employee ID must not exceed 50 characters' });
    }
  }
  if (body.designation !== undefined && body.designation !== null && body.designation !== '') {
    if (typeof body.designation !== 'string' || body.designation.trim().length > 100) {
      errors.push({ field: 'designation', message: 'Designation must not exceed 100 characters' });
    }
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateListFacultyQuery(query) {
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
  if (query.departmentId !== undefined && query.departmentId !== null && query.departmentId !== '') {
    if (!validateUUID(query.departmentId) && !validateCode(query.departmentId)) {
      errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
    }
  }
  return errors;
}

function validateFacultyIdParam(params) {
  const errors = [];
  if (!params.id) {
    errors.push({ field: 'id', message: 'Faculty ID is required' });
    return errors;
  }
  if (!validateUUID(params.id) && !validateCode(params.id)) {
    errors.push({ field: 'id', message: 'Faculty ID must be a valid UUID or business code' });
  }
  return errors;
}

module.exports = {
  validateCreateFaculty,
  validateUpdateFaculty,
  validateListFacultyQuery,
  validateFacultyIdParam,
};