const BaseController = require('../../controllers/baseController');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');
const { toSessionDto, toDeviceDto } = require('../../utils/dtoMapper');

class SessionController extends BaseController {
  constructor(sessionService) {
    super(sessionService);
    this.sessionService = sessionService;
  }

  async getSessions(req, res) {
    const options = req.query || {};
    const result = await this.sessionService.getSessions(req.user.id, options, req.user.role);
    return res.json({
      success: true,
      message: 'Sessions retrieved',
      data: result.data.map(toSessionDto),
      meta: result.meta,
    });
  }

  async getSession(req, res) {
    const session = await this.sessionService.getSession(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toSessionDto(session));
  }

  async createSession(req, res) {
    const session = await this.sessionService.createSession(req.body, req.user.id, req.user.role, req.departmentId);
    return this.created(res, toSessionDto(session));
  }

  async updateSession(req, res) {
    const updateData = {};
    const allowedFields = ['isActive', 'expiresAt'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const session = await this.sessionService.updateSession(req.params.id, updateData, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toSessionDto(session));
  }

  async revokeSession(req, res) {
    const session = await this.sessionService.revokeSession(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toSessionDto(session), 'Session revoked successfully');
  }

  async getUserDevices(req, res) {
    const result = await this.sessionService.getUserDevices(req.user.id, req.user.id, req.user.role, req.departmentId);
    return res.json({
      success: true,
      message: 'User devices retrieved',
      data: result.data.map(toDeviceDto),
      meta: result.meta,
    });
  }
}

module.exports = SessionController;
