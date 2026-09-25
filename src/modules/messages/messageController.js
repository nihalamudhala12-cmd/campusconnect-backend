const BaseController = require('../../controllers/baseController');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../errors');
const { toMessageDto } = require('../../utils/dtoMapper');

class MessageController extends BaseController {
  constructor(messageService) {
    super(messageService);
    this.messageService = messageService;
  }

  async getMessage(req, res) {
    const message = await this.messageService.getMessage(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toMessageDto(message));
  }

  async getMessages(req, res) {
    const options = {
      senderId: req.query.senderId,
      receiverId: req.query.receiverId,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      page: req.query.page ? parseInt(req.query.page, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
    };

    const result = await this.messageService.getMessages(req.user.id, req.departmentId, options);
    return res.json({
      success: true,
      message: 'Messages retrieved',
      data: result.data.map(toMessageDto),
      meta: result.meta,
    });
  }

  async createMessage(req, res) {
    const messageData = {
      senderId: req.user.id,  // Use authenticated user, not request body
      receiverId: req.body.receiverId,
      subject: req.body.subject,
      body: req.body.body,
    };
    const message = await this.messageService.createMessage(messageData, req.departmentId);
    return this.created(res, toMessageDto(message));
  }

  async updateMessage(req, res) {
    const updateData = {};
    if (req.body.body !== undefined) {
      updateData.body = req.body.body;
    }
    if (req.body.isRead !== undefined) {
      updateData.isRead = req.body.isRead;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const message = await this.messageService.updateMessage(req.params.id, updateData, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toMessageDto(message));
  }

  async deleteMessage(req, res) {
    const message = await this.messageService.deleteMessage(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toMessageDto(message), 'Message deleted successfully');
  }
}

module.exports = MessageController;
