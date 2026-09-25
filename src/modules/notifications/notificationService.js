const BaseService = require('../../services/baseService');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');

const VALID_TYPES = [
  'APPROVAL_REQUEST', 'APPROVAL_DECISION', 'ATTENDANCE_MARKED', 
  'RESULTS_PUBLISHED', 'ANNOUNCEMENT_PUBLISHED', 'MESSAGE_RECEIVED', 
  'TIMETABLE_UPDATE', 'SYSTEM'
];

const VALID_PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT'];

class NotificationService extends BaseService {
  constructor(notificationRepository, connection) {
    super(notificationRepository);
    this.connection = connection;
  }

  async getNotifications(userId, options = {}, userRole, userDepartmentId) {
    return this.repository.findAll(userId, userRole, userDepartmentId, options);
  }

  async getNotification(id, userId, userRole, userDepartmentId) {
    const notification = await this.repository.findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId);
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }
    return notification;
  }

  async createNotification(data, requesterUserId, requesterRole) {
    const errors = [];
    
    if (!data.userId) errors.push({ field: 'userId', message: 'User ID is required' });
    if (!data.type) errors.push({ field: 'type', message: 'Type is required' });
    else if (!VALID_TYPES.includes(data.type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (!data.title) errors.push({ field: 'title', message: 'Title is required' });
    if (!data.message) errors.push({ field: 'message', message: 'Message is required' });
    if (data.relatedAnnouncementId) {
      const { validateUUID } = require('../../utils/idMapper');
      if (!validateUUID(data.relatedAnnouncementId)) {
        errors.push({ field: 'relatedAnnouncementId', message: 'Related announcement ID must be a valid UUID' });
      }
    }
    if (data.priority && !VALID_PRIORITIES.includes(data.priority.toUpperCase())) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    if (requesterRole !== 'PRINCIPAL' && data.userId !== requesterUserId) {
      throw new ForbiddenError('Cannot create notification for another user');
    }

    return this.connection.withTransaction(async (client) => {
      const notification = await this.repository.create(
        {
          userId: data.userId,
          type: data.type.toUpperCase(),
          title: data.title,
          message: data.message,
          relatedAnnouncementId: data.relatedAnnouncementId || null,
          isRead: data.isRead || false,
          priority: data.priority || 'NORMAL',
        },
        client
      );
      return notification;
    });
  }

  async updateNotification(id, data, userId, userRole, userDepartmentId) {
    // Use department-scoped findById to enforce access control
    const existing = await this.repository.findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId);
    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot update notification for another user');
    }

    if (data.type !== undefined && !VALID_TYPES.includes(data.type.toUpperCase())) {
      throw new ValidationError('Invalid notification type', [{ field: 'type', message: `Type must be one of: ${VALID_TYPES.join(', ')}` }]);
    }

    if (data.priority !== undefined && !VALID_PRIORITIES.includes(data.priority.toUpperCase())) {
      throw new ValidationError('Invalid priority', [{ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` }]);
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.updateWithDepartmentScope(id, data, userId, userRole, userDepartmentId, client);
      if (!updated) {
        throw new NotFoundError('Notification not found during update');
      }
      return updated;
    });
  }

  async markNotificationAsRead(id, userId, userRole, userDepartmentId) {
    const existing = await this.repository.findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId);
    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    if (existing.user_id !== userId && userRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Cannot mark notification for another user');
    }

    if (existing.is_read) {
      return existing;
    }

    return this.connection.withTransaction(async (client) => {
      const marked = await this.repository.markAsReadWithDepartmentScope(id, userId, userRole, userDepartmentId, client);
      if (!marked) {
        throw new NotFoundError('Notification not found during mark as read');
      }
      return marked;
    });
  }

  async deleteNotification(id, userId, userRole, userDepartmentId) {
    const existing = await this.repository.findByIdWithDepartmentScope(id, userId, userRole, userDepartmentId);
    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot delete notification for another user');
    }

    return this.connection.withTransaction(async (client) => {
      const deleted = await this.repository.deleteWithDepartmentScope(id, userId, userRole, userDepartmentId, client);
      if (!deleted) {
        throw new NotFoundError('Notification not found during deletion');
      }
      return deleted;
    });
  }

  async getUserNotifications(targetUserId, options, requesterUserId, requesterRole, requesterDepartmentId) {
    if (requesterRole !== 'PRINCIPAL' && targetUserId !== requesterUserId) {
      throw new ForbiddenError('Cannot access notifications for another user');
    }
    return this.repository.findByUserId(targetUserId, requesterUserId, requesterRole, requesterDepartmentId, options);
  }
}

module.exports = NotificationService;
