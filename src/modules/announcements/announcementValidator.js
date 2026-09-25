/**
 * Announcement Validators
 * M8 — Announcements API
 *
 * Validation schemas for Announcements module requests.
 */

const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_AUDIENCES = ['DEPARTMENT', 'ALL', 'PENDING_INSTITUTION_WIDE'];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING_AUTHORIZATION'];
const VALID_TYPES = ['ANNOUNCEMENT', 'ALERT'];
const VALID_PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT'];

function validateCreateAnnouncement(body) {
  const errors = [];

  if (!body || typeof body.title !== 'string' || body.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required and must be a non-empty string' });
  } else if (body.title.trim().length > 255) {
    errors.push({ field: 'title', message: 'Title must not exceed 255 characters' });
  }

  if (!body || typeof body.content !== 'string' || body.content.trim().length === 0) {
    errors.push({ field: 'content', message: 'Content is required and must be a non-empty string' });
  }

  if (body.type !== undefined && body.type !== null && body.type !== '') {
    if (!VALID_TYPES.includes(body.type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${VALID_TYPES.join(', ')}` });
    }
  }

  if (body.audience !== undefined && body.audience !== null && body.audience !== '') {
    if (!VALID_AUDIENCES.includes(body.audience.toUpperCase())) {
      errors.push({ field: 'audience', message: `Audience must be one of: ${VALID_AUDIENCES.join(', ')}` });
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  if (body.priority !== undefined && body.priority !== null && body.priority !== '') {
    if (!VALID_PRIORITIES.includes(body.priority.toUpperCase())) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
  }

  if (body.departmentId !== undefined && body.departmentId !== null && body.departmentId !== '') {
    if (!validateUUID(body.departmentId) && !validateCode(body.departmentId)) {
      errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
    }
  }

  if (body.publishAt !== undefined && body.publishAt !== null && body.publishAt !== '') {
    const date = new Date(body.publishAt);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'publishAt', message: 'Publish date must be a valid ISO 8601 timestamp' });
    }
  }

  return errors;
}

function validateUpdateAnnouncement(body) {
  const errors = [];

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title must be a non-empty string' });
    } else if (body.title.trim().length > 255) {
      errors.push({ field: 'title', message: 'Title must not exceed 255 characters' });
    }
  }

  if (body.content !== undefined) {
    if (typeof body.content !== 'string' || body.content.trim().length === 0) {
      errors.push({ field: 'content', message: 'Content must be a non-empty string' });
    }
  }

  if (body.type !== undefined && body.type !== null && body.type !== '') {
    if (!VALID_TYPES.includes(body.type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${VALID_TYPES.join(', ')}` });
    }
  }

  if (body.audience !== undefined && body.audience !== null && body.audience !== '') {
    if (!VALID_AUDIENCES.includes(body.audience.toUpperCase())) {
      errors.push({ field: 'audience', message: `Audience must be one of: ${VALID_AUDIENCES.join(', ')}` });
    }
  }

  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  if (body.priority !== undefined && body.priority !== null && body.priority !== '') {
    if (!VALID_PRIORITIES.includes(body.priority.toUpperCase())) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
  }

  if (body.departmentId !== undefined && body.departmentId !== null && body.departmentId !== '') {
    if (!validateUUID(body.departmentId) && !validateCode(body.departmentId)) {
      errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
    }
  }

  if (body.publishAt !== undefined && body.publishAt !== null && body.publishAt !== '') {
    const date = new Date(body.publishAt);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'publishAt', message: 'Publish date must be a valid ISO 8601 timestamp' });
    }
  }

  return errors;
}

function validateListAnnouncementsQuery(query) {
  const errors = [];

  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (Number.isNaN(page) || page < 1) errors.push({ field: 'page', message: 'Page must be a positive integer' });
  }

  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 100) errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
  }

  if (query.audience !== undefined && query.audience !== '') {
    if (!VALID_AUDIENCES.includes(query.audience.toUpperCase())) {
      errors.push({ field: 'audience', message: `Audience must be one of: ${VALID_AUDIENCES.join(', ')}` });
    }
  }

  if (query.status !== undefined && query.status !== '') {
    if (!VALID_STATUSES.includes(query.status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
  }

  if (query.type !== undefined && query.type !== '') {
    if (!VALID_TYPES.includes(query.type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${VALID_TYPES.join(', ')}` });
    }
  }

  if (query.priority !== undefined && query.priority !== '') {
    if (!VALID_PRIORITIES.includes(query.priority.toUpperCase())) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
  }

  if (query.createdBy !== undefined && query.createdBy !== '') {
    if (!validateUUID(query.createdBy)) {
      errors.push({ field: 'createdBy', message: 'CreatedBy must be a valid UUID' });
    }
  }

  if (query.departmentId !== undefined && query.departmentId !== '') {
    if (!validateUUID(query.departmentId) && !validateCode(query.departmentId)) {
      errors.push({ field: 'departmentId', message: 'Department ID must be a valid UUID or business code' });
    }
  }

  if (query.publishBefore !== undefined && query.publishBefore !== '') {
    const date = new Date(query.publishBefore);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'publishBefore', message: 'PublishBefore must be a valid ISO 8601 timestamp' });
    }
  }

  if (query.publishAfter !== undefined && query.publishAfter !== '') {
    const date = new Date(query.publishAfter);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'publishAfter', message: 'PublishAfter must be a valid ISO 8601 timestamp' });
    }
  }

  return errors;
}

function validateAnnouncementIdParam(params) {
  const errors = [];

  if (!params.id) {
    errors.push({ field: 'id', message: 'Announcement ID is required' });
    return errors;
  }

  if (!validateUUID(params.id)) {
    errors.push({ field: 'id', message: 'Announcement ID must be a valid UUID' });
  }

  return errors;
}

function validateStatusUpdate(body) {
  const errors = [];

  if (!body || !body.status) {
    errors.push({ field: 'status', message: 'Status is required' });
  } else if (!VALID_STATUSES.includes(body.status.toUpperCase())) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  return errors;
}

module.exports = {
  validateCreateAnnouncement,
  validateUpdateAnnouncement,
  validateListAnnouncementsQuery,
  validateAnnouncementIdParam,
  validateStatusUpdate,
};