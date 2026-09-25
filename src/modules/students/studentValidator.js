/**
 * Student Validators
 * M3 — Students
 *
 * Validation schemas for Students module requests.
 */

const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

function validateCreateStudent(body) {
  const errors = [];
  if (!body || typeof body.userId !== 'string' || body.userId.trim().length === 0) {
    errors.push({ field: 'userId', message: 'User ID is required' });
  } else if (!validateUUID(body.userId) && !validateCode(body.userId)) {
    errors.push({ field: 'userId', message: 'User ID must be a valid UUID or business code' });
  }
  if (body.rollNumber !== undefined && body.rollNumber !== null && body.rollNumber !== '') {
    if (typeof body.rollNumber !== 'string' || body.rollNumber.trim().length > 50) {
      errors.push({ field: 'rollNumber', message: 'Roll number must not exceed 50 characters' });
    }
  }
  if (body.admissionNumber !== undefined && body.admissionNumber !== null && body.admissionNumber !== '') {
    if (typeof body.admissionNumber !== 'string' || body.admissionNumber.trim().length > 50) {
      errors.push({ field: 'admissionNumber', message: 'Admission number must not exceed 50 characters' });
    }
  }
  if (body.semester !== undefined && body.semester !== null && body.semester !== '') {
    const sem = parseInt(body.semester, 10);
    if (Number.isNaN(sem) || sem < 1 || sem > 10) {
      errors.push({ field: 'semester', message: 'Semester must be an integer between 1 and 10' });
    }
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateUpdateStudent(body) {
  const errors = [];
  if (body.rollNumber !== undefined && body.rollNumber !== null && body.rollNumber !== '') {
    if (typeof body.rollNumber !== 'string' || body.rollNumber.trim().length > 50) {
      errors.push({ field: 'rollNumber', message: 'Roll number must not exceed 50 characters' });
    }
  }
  if (body.admissionNumber !== undefined && body.admissionNumber !== null && body.admissionNumber !== '') {
    if (typeof body.admissionNumber !== 'string' || body.admissionNumber.trim().length > 50) {
      errors.push({ field: 'admissionNumber', message: 'Admission number must not exceed 50 characters' });
    }
  }
  if (body.semester !== undefined && body.semester !== null && body.semester !== '') {
    const sem = parseInt(body.semester, 10);
    if (Number.isNaN(sem) || sem < 1 || sem > 10) {
      errors.push({ field: 'semester', message: 'Semester must be an integer between 1 and 10' });
    }
  }
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }
  return errors;
}

function validateListStudentsQuery(query) {
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
  if (query.classId !== undefined && query.classId !== null && query.classId !== '') {
    if (!validateUUID(query.classId) && !validateCode(query.classId)) {
      errors.push({ field: 'classId', message: 'Class ID must be a valid UUID or business code' });
    }
  }
  if (query.departmentId !== undefined && query.departmentId !== null && query.departmentId !== '') {
    if (!validateUUID(query.departmentId) && !validateCode(query.departmentId)) {
      errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
    }
  }
  return errors;
}

function validateStudentIdParam(params) {
  const errors = [];
  if (!params.id) {
    errors.push({ field: 'id', message: 'Student ID is required' });
    return errors;
  }
  if (!validateUUID(params.id) && !validateCode(params.id)) {
    errors.push({ field: 'id', message: 'Student ID must be a valid UUID or business code' });
  }
  return errors;
}

module.exports = {
  validateCreateStudent,
  validateUpdateStudent,
  validateListStudentsQuery,
  validateStudentIdParam,
};