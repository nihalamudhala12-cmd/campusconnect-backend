// Analytics Validators
// Step 6.7 — API Module 11: Analytics
//
// Provides validation functions for analytics query parameters.
// All queries respect department scoping and RBAC.
//

const { BadRequestError } = require('../../errors');
/**
 * Validate student performance query parameters.
 *
 * @param {Object} query Request query parameters
 * @returns {Array} Array of validation error objects
 */
function validateStudentPerformanceQuery(query) {
  const errors = [];
  if (query.semester && typeof query.semester !== 'string') {
    errors.push({ field: 'semester', message: 'Semester must be a string' });
  }
  if (query.academicYear && typeof query.academicYear !== 'string') {
    errors.push({ field: 'academicYear', message: 'Academic year must be a string' });
  }
  if (query.departmentId && typeof query.departmentId !== 'string') {
    errors.push({ field: 'departmentId', message: 'Department ID must be a string' });
  }
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
    }
  }
  return errors;
}
/**
 * Validate faculty statistics query parameters.
 *
 * @param {Object} query Request query parameters
 * @returns {Array} Array of validation error objects
 */
function validateFacultyStatsQuery(query) {
  const errors = [];
  if (query.semester && typeof query.semester !== 'string') {
    errors.push({ field: 'semester', message: 'Semester must be a string' });
  }
  if (query.academicYear && typeof query.academicYear !== 'string') {
    errors.push({ field: 'academicYear', message: 'Academic year must be a string' });
  }
  if (query.departmentId && typeof query.departmentId !== 'string') {
    errors.push({ field: 'departmentId', message: 'Department ID must be a string' });
  }
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
    }
  }
  return errors;
}
/**
 * Validate attendance analytics query parameters.
 *
 * @param {Object} query Request query parameters
 * @returns {Array} Array of validation error objects
 */
function validateAttendanceQuery(query) {
  const errors = [];
  if (query.semester && typeof query.semester !== 'string') {
    errors.push({ field: 'semester', message: 'Semester must be a string' });
  }
  if (query.academicYear && typeof query.academicYear !== 'string') {
    errors.push({ field: 'academicYear', message: 'Academic year must be a string' });
  }
  if (query.departmentId && typeof query.departmentId !== 'string') {
    errors.push({ field: 'departmentId', message: 'Department ID must be a string' });
  }
  if (query.attendanceType && !['TOTAL', 'PERCENTAGE'].includes(query.attendanceType)) {
    errors.push({ field: 'attendanceType', message: 'Attendance type must be TOTAL or PERCENTAGE' });
  }
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
    }
  }
  return errors;
}
/**
 * Validate results analytics query parameters.
 *
 * @param {Object} query Request query parameters
 * @returns {Array} Array of validation error objects
 */
function validateResultsQuery(query) {
  const errors = [];
  if (query.semester && typeof query.semester !== 'string') {
    errors.push({ field: 'semester', message: 'Semester must be a string' });
  }
  if (query.academicYear && typeof query.academicYear !== 'string') {
    errors.push({ field: 'academicYear', message: 'Academic year must be a string' });
  }
  if (query.departmentId && typeof query.departmentId !== 'string') {
    errors.push({ field: 'departmentId', message: 'Department ID must be a string' });
  }
  if (query.assessmentType && typeof query.assessmentType !== 'string') {
    errors.push({ field: 'assessmentType', message: 'Assessment type must be a string' });
  }
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
    }
  }
  return errors;
}
/**
 * Validate cross-domain analytics query parameters.
 *
 * @param {Object} query Request query parameters
 * @returns {Array} Array of validation error objects
 */
function validateCrossDomainQuery(query) {
  const errors = [];
  if (query.semesters && typeof query.semesters !== 'string') {
    errors.push({ field: 'semesters', message: 'Semesters must be a comma-separated string' });
  }
  if (query.academicYears && typeof query.academicYears !== 'string') {
    errors.push({ field: 'academicYears', message: 'Academic years must be a comma-separated string' });
  }
  if (query.departmentIds && typeof query.departmentIds !== 'string') {
    errors.push({ field: 'departmentIds', message: 'Department IDs must be a comma-separated string' });
  }
  if (query.analysisType && !['CORRELATION', 'TREND', 'COMPARISON'].includes(query.analysisType)) {
    errors.push({ field: 'analysisType', message: 'Analysis type must be CORRELATION, TREND, or COMPARISON' });
  }
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
    }
  }
  return errors;
}

module.exports = {
  validateStudentPerformanceQuery,
  validateFacultyStatsQuery,
  validateAttendanceQuery,
  validateResultsQuery,
  validateCrossDomainQuery,
};
