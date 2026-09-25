const BaseController = require('../../controllers/baseController');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');
const { toNotificationDto } = require('../../utils/dtoMapper');

class NotificationController extends BaseController {
  constructor(notificationService) {
    super(notificationService);
    this.notificationService = notificationService;
  }

  async getNotifications(req, res, options) {
    const result = await this.notificationService.getNotifications(req.user.id, options || req.query, req.user.role, req.departmentId);
    return res.json({
      success: true,
      message: 'Notifications retrieved',
      data: result.data.map(toNotificationDto),
      meta: result.meta,
    });
  }

  async getNotification(req, res) {
    const notification = await this.notificationService.getNotification(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toNotificationDto(notification));
  }

  async createNotification(req, res) {
    const notification = await this.notificationService.createNotification(req.body, req.user.id, req.user.role);
    return this.created(res, toNotificationDto(notification));
  }

  async updateNotification(req, res) {
    const updateData = {};
    const allowedFields = ['title', 'message', 'type', 'isRead', 'priority', 'relatedAnnouncementId'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const notification = await this.notificationService.updateNotification(req.params.id, updateData, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toNotificationDto(notification));
  }

  async markNotificationAsRead(req, res) {
    const notification = await this.notificationService.markNotificationAsRead(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toNotificationDto(notification), 'Notification marked as read');
  }

  async deleteNotification(req, res) {
    const notification = await this.notificationService.deleteNotification(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toNotificationDto(notification), 'Notification deleted successfully');
  }

  async getUserNotifications(req, res, options) {
    const userId = req.params.userId;
    const result = await this.notificationService.getUserNotifications(userId, options || req.query, req.user.id, req.user.role, req.departmentId);
    return res.json({
      success: true,
      message: 'User notifications retrieved',
      data: result.data.map(toNotificationDto),
      meta: result.meta,
    });
  }
}

module.exports = NotificationController;
