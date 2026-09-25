// Message Validators
// Step 6.7 — API Module 9: Messages
//
// Provides validation functions for message-related operations.
// These validators are used by the validation middleware to ensure
// request payloads conform to expected schemas before processing.
//

const { BadRequestError } = require('../../errors');
/**
 * Validate message creation payload.
 *
 * @param {Object} data Request body data
 * @returns {Array} Array of validation error objects
 */
function validateCreateMessage(data) {
  const errors = [];
  if (!data.senderId) {
    errors.push({ field: 'senderId', message: 'Sender ID is required' });
  }
  if (!data.receiverId) {
    errors.push({ field: 'receiverId', message: 'Receiver ID is required' });
  }
  if (data.senderId === data.receiverId) {
    errors.push({ field: 'senderId', message: 'Sender and receiver must be different users' });
  }
  if (!data.body || !data.body.trim()) {
    errors.push({ field: 'body', message: 'Message body is required' });
  }
  if (data.body && data.body.length > 5000) {
    errors.push({ field: 'body', message: 'Message body cannot exceed 5000 characters' });
  }
  return errors;
}
/**
 * Validate message update payload.
 *
 * @param {Object} data Request body data
 * @returns {Array} Array of validation error objects
 */
function validateUpdateMessage(data) {
  const errors = [];
  if (data.body !== undefined) {
    if (!data.body || !data.body.trim()) {
      errors.push({ field: 'body', message: 'Message body cannot be empty' });
    }
    if (data.body.length > 5000) {
      errors.push({ field: 'body', message: 'Message body cannot exceed 5000 characters' });
    }
  }
  if (data.isRead !== undefined && typeof data.isRead !== 'boolean') {
    errors.push({ field: 'isRead', message: 'isRead must be a boolean value' });
  }
  return errors;
}
/**
 * Validate query parameters for listing messages.
 *
 * @param {Object} query Request query parameters
 * @returns {Array} Array of validation error objects
 */
function validateListMessagesQuery(query) {
  const errors = [];
  if (query.senderId && typeof query.senderId !== 'string') {
    errors.push({ field: 'senderId', message: 'senderId must be a string' });
  }
  if (query.receiverId && typeof query.receiverId !== 'string') {
    errors.push({ field: 'receiverId', message: 'receiverId must be a string' });
  }
  if (query.isRead !== undefined && typeof query.isRead !== 'string') {
    errors.push({ field: 'isRead', message: 'isRead must be a string (true/false)' });
  }
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'page must be a positive integer' });
    }
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'limit must be an integer between 1 and 100' });
    }
  }
  return errors;
}
/**
 * Validate message ID parameter.
 *
 * @param {string} id Message ID from request parameters
 * @returns {Array} Array of validation error objects
 */
function validateMessageIdParam(id) {
  const errors = [];
  if (!id) {
    errors.push({ field: 'id', message: 'Message ID is required' });
    return errors;
  }
  const { validateUUID } = require('../../utils/idMapper');
  if (!validateUUID(id)) {
    errors.push({ field: 'id', message: 'Message ID must be a valid UUID' });
  }
  return errors;
}

module.exports = {
  validateCreateMessage,
  validateUpdateMessage,
  validateListMessagesQuery,
  validateMessageIdParam,
};
