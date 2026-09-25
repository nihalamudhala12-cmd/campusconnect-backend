// Approval Validators
// Step 6.7 — API Module 10: Approvals
//
// Provides validation functions for approval-related operations.
//

const { BadRequestError } = require('../../errors');
/**
 * Validate approval creation payload.
 *
 * @param {Object} data Request body data
 * @returns {Array} Array of validation error objects
 */
function validateCreateApproval(data) {
  const errors = [];
  if (!data.type) {
    errors.push({ field: 'type', message: 'Approval type is required' });
  }
  if (!['LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER'].includes(data.type)) {
    errors.push({ field: 'type', message: 'Invalid approval type' });
  }
  if (!data.departmentId) {
    errors.push({ field: 'departmentId', message: 'Department ID is required' });
  }
  if (data.description && data.description.length > 1000) {
    errors.push({ field: 'description', message: 'Description cannot exceed 1000 characters' });
  }
  if (data.remarks && data.remarks.length > 1000) {
    errors.push({ field: 'remarks', message: 'Remarks cannot exceed 1000 characters' });
  }
  return errors;
}
/**
 * Validate approval update payload (review action).
 *
 * @param {Object} data Request body data
 * @returns {Array} Array of validation error objects
 */
function validateUpdateApproval(data) {
  const errors = [];
  if (data.status !== undefined) {
    if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(data.status)) {
      errors.push({ field: 'status', message: 'Status must be PENDING, APPROVED, REJECTED, or CANCELLED' });
    }
    if (data.status === 'APPROVED' && !data.reviewedBy) {
      errors.push({ field: 'reviewedBy', message: 'Reviewer ID is required for approval' });
    }
  }
  if (data.reviewedBy !== undefined && typeof data.reviewedBy !== 'string') {
    errors.push({ field: 'reviewedBy', message: 'Reviewer ID must be a string' });
  }
  if (data.remarks !== undefined && data.remarks.length > 1000) {
    errors.push({ field: 'remarks', message: 'Remarks cannot exceed 1000 characters' });
  }
  return errors;
}
/**
 * Validate query parameters for listing approvals.
 *
 * @param {Object} query Request query parameters
 * @returns {Array} Array of validation error objects
 */
function validateListApprovalsQuery(query) {
  const errors = [];
  if (query.type && !['LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER'].includes(query.type)) {
    errors.push({ field: 'type', message: 'Invalid approval type' });
  }
  if (query.status && !['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(query.status)) {
    errors.push({ field: 'status', message: 'Status must be PENDING, APPROVED, REJECTED, or CANCELLED' });
  }
  if (query.requestedBy && typeof query.requestedBy !== 'string') {
    errors.push({ field: 'requestedBy', message: 'Requested by ID must be a string' });
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
 * Validate approval ID parameter.
 *
 * @param {string} id Approval ID from request parameters
 * @returns {Array} Array of validation error objects
 */
function validateApprovalIdParam(id) {
  const errors = [];
  if (!id) {
    errors.push({ field: 'id', message: 'Approval ID is required' });
  }
  return errors;
}

module.exports = {
  validateCreateApproval,
  validateUpdateApproval,
  validateListApprovalsQuery,
  validateApprovalIdParam,
};
