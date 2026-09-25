const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let notificationController = null;

function getController() {
  if (!notificationController) {
    const NotificationController = require('./notificationController');
    const NotificationService = require('./notificationService');
    const NotificationRepository = require('./notificationRepository');
    const connection = require('../../infrastructure/database/connection');
    const notificationRepository = new NotificationRepository(connection.getPool());
    const notificationService = new NotificationService(notificationRepository, connection);
    notificationController = new NotificationController(notificationService);
  }
  return notificationController;
}

// Create notification schema
const createNotificationSchema = {
  body: (body) => {
    const errors = [];
    if (!body || typeof body.userId !== 'string' || body.userId.trim().length === 0) {
      errors.push({ field: 'userId', message: 'User ID is required' });
    }
    if (!body || typeof body.type !== 'string' || body.type.trim().length === 0) {
      errors.push({ field: 'type', message: 'Type is required' });
    }
    if (body.type && !['APPROVAL_REQUEST', 'APPROVAL_DECISION', 'ATTENDANCE_MARKED', 'RESULTS_PUBLISHED', 'ANNOUNCEMENT_PUBLISHED', 'MESSAGE_RECEIVED', 'TIMETABLE_UPDATE', 'SYSTEM'].includes(body.type.toUpperCase())) {
      errors.push({ field: 'type', message: 'Type must be one of: APPROVAL_REQUEST, APPROVAL_DECISION, ATTENDANCE_MARKED, RESULTS_PUBLISHED, ANNOUNCEMENT_PUBLISHED, MESSAGE_RECEIVED, TIMETABLE_UPDATE, SYSTEM' });
    }
    if (!body || typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (body.title && body.title.length > 255) {
      errors.push({ field: 'title', message: 'Title must not exceed 255 characters' });
    }
    if (!body || typeof body.message !== 'string' || body.message.trim().length === 0) {
      errors.push({ field: 'message', message: 'Message is required' });
    }
    if (body.relatedAnnouncementId !== undefined && body.relatedAnnouncementId !== null && body.relatedAnnouncementId !== '') {
      const { validateUUID } = require('../../utils/idMapper');
      if (!validateUUID(body.relatedAnnouncementId)) {
        errors.push({ field: 'relatedAnnouncementId', message: 'Related announcement ID must be a valid UUID' });
      }
    }
    if (body.priority !== undefined && body.priority !== null && body.priority !== '') {
      if (!['NORMAL', 'IMPORTANT', 'URGENT'].includes(body.priority.toUpperCase())) {
        errors.push({ field: 'priority', message: 'Priority must be one of: NORMAL, IMPORTANT, URGENT' });
      }
    }
    return errors;
  }
};

// Update notification schema
const updateNotificationSchema = {
  body: (body) => {
    const errors = [];
    if (body.type !== undefined) {
      if (!['APPROVAL_REQUEST', 'APPROVAL_DECISION', 'ATTENDANCE_MARKED', 'RESULTS_PUBLISHED', 'ANNOUNCEMENT_PUBLISHED', 'MESSAGE_RECEIVED', 'TIMETABLE_UPDATE', 'SYSTEM'].includes(body.type.toUpperCase())) {
        errors.push({ field: 'type', message: 'Type must be one of: APPROVAL_REQUEST, APPROVAL_DECISION, ATTENDANCE_MARKED, RESULTS_PUBLISHED, ANNOUNCEMENT_PUBLISHED, MESSAGE_RECEIVED, TIMETABLE_UPDATE, SYSTEM' });
      }
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        errors.push({ field: 'title', message: 'Title must be a non-empty string' });
      } else if (body.title.length > 255) {
        errors.push({ field: 'title', message: 'Title must not exceed 255 characters' });
      }
    }
    if (body.message !== undefined) {
      if (typeof body.message !== 'string' || body.message.trim().length === 0) {
        errors.push({ field: 'message', message: 'Message must be a non-empty string' });
      }
    }
    if (body.isRead !== undefined && typeof body.isRead !== 'boolean') {
      errors.push({ field: 'isRead', message: 'isRead must be a boolean value' });
    }
    if (body.priority !== undefined) {
      if (!['NORMAL', 'IMPORTANT', 'URGENT'].includes(body.priority.toUpperCase())) {
        errors.push({ field: 'priority', message: 'Priority must be one of: NORMAL, IMPORTANT, URGENT' });
      }
    }
    if (body.relatedAnnouncementId !== undefined) {
      const { validateUUID } = require('../../utils/idMapper');
      if (body.relatedAnnouncementId !== null && body.relatedAnnouncementId !== '') {
        if (!validateUUID(body.relatedAnnouncementId)) {
          errors.push({ field: 'relatedAnnouncementId', message: 'Related announcement ID must be a valid UUID or null' });
        }
      }
    }
    return errors;
  }
};

// List notifications query schema
const listNotificationsSchema = {
  query: (query) => {
    const errors = [];
    if (query.page !== undefined) {
      const page = parseInt(query.page, 10);
      if (Number.isNaN(page) || page < 1) {
        errors.push({ field: 'page', message: 'Page must be a positive integer' });
      }
    }
    if (query.limit !== undefined) {
      const limit = parseInt(query.limit, 10);
      if (Number.isNaN(limit) || limit < 1 || limit > 100) {
        errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
      }
    }
    if (query.type !== undefined && query.type !== '') {
      if (!['APPROVAL_REQUEST', 'APPROVAL_DECISION', 'ATTENDANCE_MARKED', 'RESULTS_PUBLISHED', 'ANNOUNCEMENT_PUBLISHED', 'MESSAGE_RECEIVED', 'TIMETABLE_UPDATE', 'SYSTEM'].includes(query.type.toUpperCase())) {
        errors.push({ field: 'type', message: 'Type must be one of: APPROVAL_REQUEST, APPROVAL_DECISION, ATTENDANCE_MARKED, RESULTS_PUBLISHED, ANNOUNCEMENT_PUBLISHED, MESSAGE_RECEIVED, TIMETABLE_UPDATE, SYSTEM' });
      }
    }
    if (query.isRead !== undefined && query.isRead !== '') {
      if (typeof query.isRead !== 'string') {
        errors.push({ field: 'isRead', message: 'isRead must be a string (true/false)' });
      } else if (!['true', 'false'].includes(query.isRead.toLowerCase())) {
        errors.push({ field: 'isRead', message: 'isRead must be true or false' });
      }
    }
    return errors;
  }
};

// Notification ID parameter schema
const notificationIdSchema = {
  params: (params) => {
    const errors = [];
    if (!params.id) {
      errors.push({ field: 'id', message: 'Notification ID is required' });
      return errors;
    }
    const { validateUUID } = require('../../utils/idMapper');
    if (!validateUUID(params.id)) {
      errors.push({ field: 'id', message: 'Notification ID must be a valid UUID' });
    }
    return errors;
  }
};

// GET /notifications - List notifications for current user
router.get('/notifications',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(listNotificationsSchema),
  asyncHandler(async (req, res) => {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      type: req.query.type,
      isRead: req.query.isRead,
    };
    await getController().getNotifications(req, res, options);
  })
);

// GET /notifications/:id - Get specific notification
router.get('/notifications/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(notificationIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getNotification(req, res);
  })
);

// POST /notifications - Create new notification
router.post('/notifications',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(createNotificationSchema),
  asyncHandler(async (req, res) => {
    await getController().createNotification(req, res);
  })
);

// PUT /notifications/:id - Update notification
router.put('/notifications/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(notificationIdSchema),
  validateRequest(updateNotificationSchema),
  asyncHandler(async (req, res) => {
    await getController().updateNotification(req, res);
  })
);

// PATCH /notifications/:id/read - Mark notification as read
router.patch('/notifications/:id/read',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(notificationIdSchema),
  asyncHandler(async (req, res) => {
    await getController().markNotificationAsRead(req, res);
  })
);

// DELETE /notifications/:id - Delete notification
router.delete('/notifications/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(notificationIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deleteNotification(req, res);
  })
);

// GET /users/:userId/notifications - Get notifications for specific user (HOD/FACULTY/PRINCIPAL only)
router.get('/users/:userId/notifications',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest({
    params: (params) => {
      const errors = [];
      const { validateUUID, validateCode } = require('../../utils/idMapper');
      if (!params.userId) {
        errors.push({ field: 'userId', message: 'User ID is required' });
        return errors;
      }
      if (!validateUUID(params.userId) && !validateCode(params.userId)) {
        errors.push({ field: 'userId', message: 'User ID must be a valid UUID or business code' });
      }
      return errors;
    }
  }),
  asyncHandler(async (req, res) => {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      type: req.query.type,
      isRead: req.query.isRead,
    };
    await getController().getUserNotifications(req, res, options);
  })
);

module.exports = router;
