/**
 * Class Validators
 * M5 — Classes
 */

const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

function validateCreateClass(body) {
  const errors = [];
  if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (body.name.trim().length > 100) {
    errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
  }
  if (!body || !body.code || typeof body.code !== 'string') {
    errors.push({ field: 'code', message: 'Code is required' });
  } else if (body.code.trim().length > 20) {
    errors.push({ field: 'code', message: 'Code must not exceed 20 characters' });
  }
  if (!body || !body.departmentId) {
    errors.push({ field: 'departmentId', message: 'Department ID is required' });
  } else if (!validateUUID(body.departmentId) && !validateCode(body.departmentId)) {
    errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
  }
  if (body.semester !== undefined && body.semester !== null && body.semester !== '') {
    const sem = parseInt(body.semester, 10);
    if (Number.isNaN(sem) || sem < 1 || sem > 10) {
      errors.push({ field: 'semester', message: 'Semester must be an integer between 1 and 10' });
    }
  }
  if (body.section !== undefined && body.section !== null && body.section !== '') {
    if (typeof body.section !== 'string' || body.section.trim().length > 10) {
      errors.push({ field: 'section', message: 'Section must not exceed 10 characters' });
    }
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateUpdateClass(body) {
  const errors = [];
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name must be a non-empty string' });
    } else if (body.name.trim().length > 100) {
      errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
    }
  }
  if (body.code !== undefined) {
    if (typeof body.code !== 'string' || body.code.trim().length === 0) {
      errors.push({ field: 'code', message: 'Code must be a non-empty string' });
    } else if (body.code.trim().length > 20) {
      errors.push({ field: 'code', message: 'Code must not exceed 20 characters' });
    }
  }
  if (body.semester !== undefined && body.semester !== null && body.semester !== '') {
    const sem = parseInt(body.semester, 10);
    if (Number.isNaN(sem) || sem < 1 || sem > 10) {
      errors.push({ field: 'semester', message: 'Semester must be an integer between 1 and 10' });
    }
  }
  if (body.section !== undefined && body.section !== null && body.section !== '') {
    if (typeof body.section !== 'string' || body.section.trim().length > 10) {
      errors.push({ field: 'section', message: 'Section must not exceed 10 characters' });
    }
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateListClassesQuery(query) {
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
  if (query.semester !== undefined && query.semester !== null && query.semester !== '') {
    const sem = parseInt(query.semester, 10);
    if (Number.isNaN(sem) || sem < 1 || sem > 10) {
      errors.push({ field: 'semester', message: 'Semester must be an integer between 1 and 10' });
    }
  }
  return errors;
}

function validateClassIdParam(params) {
  const errors = [];
  if (!params.id) {
    errors.push({ field: 'id', message: 'Class ID is required' });
    return errors;
  }
  if (!validateUUID(params.id)) {
    errors.push({ field: 'id', message: 'Class ID must be a valid UUID' });
  }
  return errors;
}

module.exports = {
  validateCreateClass,
  validateUpdateClass,
  validateListClassesQuery,
  validateClassIdParam,
};