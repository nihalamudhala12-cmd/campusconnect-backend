/**
 * Attendance Validators
 * M6 — Attendance
 *
 * Validation schemas for Attendance module requests.
 */

const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_STATUSES = ['PRESENT', 'ABSENT', 'LATE'];

function validateCreateAttendance(body) {
  const errors = [];

  if (!body || typeof body.studentId !== 'string' || body.studentId.trim().length === 0) {
    errors.push({ field: 'studentId', message: 'Student ID is required' });
  } else if (!validateUUID(body.studentId) && !validateCode(body.studentId)) {
    errors.push({ field: 'studentId', message: 'Student ID must be a valid UUID or business code' });
  }

  if (!body || typeof body.facultyId !== 'string' || body.facultyId.trim().length === 0) {
    errors.push({ field: 'facultyId', message: 'Faculty ID is required' });
  } else if (!validateUUID(body.facultyId) && !validateCode(body.facultyId)) {
    errors.push({ field: 'facultyId', message: 'Faculty ID must be a valid UUID or business code' });
  }

  if (!body || typeof body.classId !== 'string' || body.classId.trim().length === 0) {
    errors.push({ field: 'classId', message: 'Class ID is required' });
  } else if (!validateUUID(body.classId) && !validateCode(body.classId)) {
    errors.push({ field: 'classId', message: 'Class ID must be a valid UUID or business code' });
  }

  if (!body || typeof body.courseId !== 'string' || body.courseId.trim().length === 0) {
    errors.push({ field: 'courseId', message: 'Course ID is required' });
  } else if (!validateUUID(body.courseId) && !validateCode(body.courseId)) {
    errors.push({ field: 'courseId', message: 'Course ID must be a valid UUID or business code' });
  }

  if (!body || !body.attendanceDate) {
    errors.push({ field: 'attendanceDate', message: 'Attendance date is required' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.attendanceDate)) {
    errors.push({ field: 'attendanceDate', message: 'Attendance date must be in YYYY-MM-DD format' });
  }

  if (!body || !body.status) {
    errors.push({ field: 'status', message: 'Status is required' });
  } else if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (body.remarks !== undefined && body.remarks !== null && body.remarks !== '') {
    if (typeof body.remarks !== 'string' || body.remarks.trim().length > 500) {
      errors.push({ field: 'remarks', message: 'Remarks must not exceed 500 characters' });
    }
  }

  return errors;
}

function validateUpdateAttendance(body) {
  const errors = [];

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  if (body.remarks !== undefined && body.remarks !== null && body.remarks !== '') {
    if (typeof body.remarks !== 'string' || body.remarks.trim().length > 500) {
      errors.push({ field: 'remarks', message: 'Remarks must not exceed 500 characters' });
    }
  }

  return errors;
}

function validateListAttendanceQuery(query) {
  const errors = [];

  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (Number.isNaN(page) || page < 1) errors.push({ field: 'page', message: 'Page must be a positive integer' });
  }

  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 100) errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
  }

  if (query.studentId !== undefined && query.studentId !== null && query.studentId !== '') {
    if (!validateUUID(query.studentId) && !validateCode(query.studentId)) {
      errors.push({ field: 'studentId', message: 'Student ID must be a valid UUID or business code' });
    }
  }

  if (query.facultyId !== undefined && query.facultyId !== null && query.facultyId !== '') {
    if (!validateUUID(query.facultyId) && !validateCode(query.facultyId)) {
      errors.push({ field: 'facultyId', message: 'Faculty ID must be a valid UUID or business code' });
    }
  }

  if (query.classId !== undefined && query.classId !== null && query.classId !== '') {
    if (!validateUUID(query.classId) && !validateCode(query.classId)) {
      errors.push({ field: 'classId', message: 'Class ID must be a valid UUID or business code' });
    }
  }

  if (query.courseId !== undefined && query.courseId !== null && query.courseId !== '') {
    if (!validateUUID(query.courseId) && !validateCode(query.courseId)) {
      errors.push({ field: 'courseId', message: 'Course ID must be a valid UUID or business code' });
    }
  }

  if (query.status !== undefined && query.status !== '') {
    if (!VALID_STATUSES.includes(query.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  if (query.date !== undefined && query.date !== null && query.date !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
      errors.push({ field: 'date', message: 'Date must be in YYYY-MM-DD format' });
    }
  }

  return errors;
}

function validateAttendanceIdParam(params) {
  const errors = [];
  if (!params.id) {
    errors.push({ field: 'id', message: 'Attendance ID is required' });
    return errors;
  }
  if (!validateUUID(params.id)) {
    errors.push({ field: 'id', message: 'Attendance ID must be a valid UUID' });
  }
  return errors;
}

module.exports = {
  validateCreateAttendance,
  validateUpdateAttendance,
  validateListAttendanceQuery,
  validateAttendanceIdParam,
};
