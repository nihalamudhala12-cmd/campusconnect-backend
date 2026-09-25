/**
 * User Controller
 * Step 6.7 — API Module 1: Users
 *
 * Translates HTTP requests into service calls and formats canonical responses.
 * Extends BaseController for standardized response envelopes.
 */

const BaseController = require('../../controllers/baseController');
const { ValidationError, BadRequestError } = require('../../errors');
const { toUserDto } = require('../../utils/dtoMapper');

class UserController extends BaseController {
  constructor(userService) {
    super(userService);
    this.userService = userService;
  }

  async getUser(req, res) {
    const user = await this.userService.getUser(req.params.id, req.departmentId);
    return this.ok(res, toUserDto(user));
  }

  async getUsers(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      role: req.query.role,
      status: req.query.status,
      search: req.query.search,
    };

    const result = await this.userService.getUsers(req.departmentId, options);
    return res.json({
      success: true,
      message: 'Users retrieved',
      data: result.data.map(toUserDto),
      meta: result.meta,
    });
  }

  async createUser(req, res) {
    const user = await this.userService.createUser(req.body, req.departmentId);
    return this.created(res, toUserDto(user));
  }

  async updateUser(req, res) {
    const allowedFields = ['name', 'email', 'role', 'departmentId', 'status', 'profileCompleted'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const user = await this.userService.updateUser(req.params.id, updateData, req.departmentId);
    return this.ok(res, toUserDto(user));
  }

  async completeProfile(req, res) {
    const user = await this.userService.updateUser(req.user.id, { profileCompleted: true }, req.departmentId);
    return this.ok(res, toUserDto(user), 'Profile completed successfully');
  }

  async deactivateUser(req, res) {
    const user = await this.userService.deactivateUser(req.params.id, req.departmentId);
    return this.ok(res, toUserDto(user), 'User deactivated successfully');
  }
}

module.exports = UserController;
