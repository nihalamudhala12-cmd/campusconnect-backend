/**
 * Result Validators
 * M7 — Results
 *
 * Validation schemas for Results module requests.
 */

const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_ASSESSMENT_TYPES = ['ASSIGNMENT', 'CLASS_TEST', 'MID_TERM', 'END_TERM', 'LAB', 'PROJECT', 'PRESENTATION', 'PARTICIPATION'];
const VALID_STATUSES = ['DRAFT', 'SUBMITTED', 'PUBLISHED', 'REVISION_PENDING'];

function validateAcademicYear(academicYear) {
  if (!academicYear || typeof academicYear !== 'string') {
    return false;
  }
  const pattern = /^\d{4}-\d{2}$/;
  if (!pattern.test(academicYear)) {
    return false;
  }
  const [startYearStr, endYearStr] = academicYear.split('-');
  const startYear = parseInt(startYearStr, 10);
  const endYear = parseInt(endYearStr, 10);
  const expectedEndYear = (startYear + 1) % 100;
  return endYear === expectedEndYear;
}

function validateCreateResult(body) {
  const errors = [];

  if (!body || typeof body.studentId !== 'string' || body.studentId.trim().length === 0) {
    errors.push({ field: 'studentId', message: 'Student ID is required' });
  } else if (!validateUUID(body.studentId) && !validateCode(body.studentId)) {
    errors.push({ field: 'studentId', message: 'Student ID must be a valid UUID or business code' });
  }

  if (!body || typeof body.courseId !== 'string' || body.courseId.trim().length === 0) {
    errors.push({ field: 'courseId', message: 'Course ID is required' });
  } else if (!validateUUID(body.courseId) && !validateCode(body.courseId)) {
    errors.push({ field: 'courseId', message: 'Course ID must be a valid UUID or business code' });
  }

  if (!body || !body.assessmentType) {
    errors.push({ field: 'assessmentType', message: 'Assessment type is required' });
  } else if (!VALID_ASSESSMENT_TYPES.includes(body.assessmentType.toUpperCase())) {
    errors.push({ field: 'assessmentType', message: `Assessment type must be one of: ${VALID_ASSESSMENT_TYPES.join(', ')}` });
  }

  if (body.semester === undefined || body.semester === null || body.semester === '') {
    errors.push({ field: 'semester', message: 'Semester is required' });
  } else {
    const sem = parseInt(body.semester, 10);
    if (Number.isNaN(sem) || sem < 1 || sem > 10) {
      errors.push({ field: 'semester', message: 'Semester must be an integer between 1 and 10' });
    }
  }

  if (!body || !body.academicYear) {
    errors.push({ field: 'academicYear', message: 'Academic year is required' });
  } else if (!validateAcademicYear(body.academicYear)) {
    errors.push({ field: 'academicYear', message: 'Academic year must be in format YYYY-YY (e.g., 2026-27)' });
  }

  if (body.maxMarks === undefined || body.maxMarks === null || body.maxMarks === '') {
    errors.push({ field: 'maxMarks', message: 'Max marks is required' });
  } else {
    const maxMarks = Number(body.maxMarks);
    if (Number.isNaN(maxMarks) || maxMarks <= 0) {
      errors.push({ field: 'maxMarks', message: 'Max marks must be a positive number' });
    }
  }

  if (body.marksObtained !== undefined && body.marksObtained !== null && body.marksObtained !== '') {
    const marksObtained = Number(body.marksObtained);
    if (Number.isNaN(marksObtained) || marksObtained < 0) {
      errors.push({ field: 'marksObtained', message: 'Marks obtained must be a non-negative number' });
    }
  }

  if (body.grade !== undefined && body.grade !== null && body.grade !== '') {
    if (typeof body.grade !== 'string' || body.grade.trim().length > 5) {
      errors.push({ field: 'grade', message: 'Grade must not exceed 5 characters' });
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  return errors;
}

function validateUpdateResult(body) {
  const errors = [];

  if (body.marksObtained !== undefined && body.marksObtained !== null && body.marksObtained !== '') {
    const marksObtained = Number(body.marksObtained);
    if (Number.isNaN(marksObtained) || marksObtained < 0) {
      errors.push({ field: 'marksObtained', message: 'Marks obtained must be a non-negative number' });
    }
  }

  if (body.maxMarks !== undefined && body.maxMarks !== null && body.maxMarks !== '') {
    const maxMarks = Number(body.maxMarks);
    if (Number.isNaN(maxMarks) || maxMarks <= 0) {
      errors.push({ field: 'maxMarks', message: 'Max marks must be a positive number' });
    }
  }

  if (body.grade !== undefined && body.grade !== null && body.grade !== '') {
    if (typeof body.grade !== 'string' || body.grade.trim().length > 5) {
      errors.push({ field: 'grade', message: 'Grade must not exceed 5 characters' });
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  return errors;
}

function validateListResultsQuery(query) {
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

  if (query.courseId !== undefined && query.courseId !== null && query.courseId !== '') {
    if (!validateUUID(query.courseId) && !validateCode(query.courseId)) {
      errors.push({ field: 'courseId', message: 'Course ID must be a valid UUID or business code' });
    }
  }

  if (query.assessmentType !== undefined && query.assessmentType !== null && query.assessmentType !== '') {
    if (!VALID_ASSESSMENT_TYPES.includes(query.assessmentType.toUpperCase())) {
      errors.push({ field: 'assessmentType', message: `Assessment type must be one of: ${VALID_ASSESSMENT_TYPES.join(', ')}` });
    }
  }

  if (query.semester !== undefined && query.semester !== null && query.semester !== '') {
    const sem = parseInt(query.semester, 10);
    if (Number.isNaN(sem) || sem < 1 || sem > 10) {
      errors.push({ field: 'semester', message: 'Semester must be an integer between 1 and 10' });
    }
  }

  if (query.academicYear !== undefined && query.academicYear !== null && query.academicYear !== '') {
    if (!validateAcademicYear(query.academicYear)) {
      errors.push({ field: 'academicYear', message: 'Academic year must be in format YYYY-YY (e.g., 2026-27)' });
    }
  }

  if (query.status !== undefined && query.status !== '') {
    if (!VALID_STATUSES.includes(query.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  return errors;
}

function validateResultIdParam(params) {
  const errors = [];
  if (!params.id) {
    errors.push({ field: 'id', message: 'Result ID is required' });
    return errors;
  }
  if (!validateUUID(params.id)) {
    errors.push({ field: 'id', message: 'Result ID must be a valid UUID' });
  }
  return errors;
}

module.exports = {
  validateCreateResult,
  validateUpdateResult,
  validateListResultsQuery,
  validateResultIdParam,
  VALID_ASSESSMENT_TYPES,
  VALID_STATUSES,
};