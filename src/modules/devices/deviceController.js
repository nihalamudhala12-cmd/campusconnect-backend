const BaseController = require('../../controllers/baseController');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');
const { toDeviceDto } = require('../../utils/dtoMapper');

class DeviceController extends BaseController {
  constructor(deviceService) {
    super(deviceService);
    this.deviceService = deviceService;
  }

  async getDevices(req, res) {
    const options = req.query || {};
    const result = await this.deviceService.getDevices(req.user.id, options);
    return res.json({
      success: true,
      message: 'Devices retrieved',
      data: result.data.map(toDeviceDto),
      meta: result.meta,
    });
  }

  async getDevice(req, res) {
    const device = await this.deviceService.getDevice(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toDeviceDto(device));
  }

  async createDevice(req, res) {
    const device = await this.deviceService.createDevice(req.body, req.user.id, req.user.role, req.departmentId);
    return this.created(res, toDeviceDto(device));
  }

  async updateDevice(req, res) {
    const updateData = {};
    const allowedFields = ['deviceName', 'deviceType', 'deviceModel', 'osVersion', 'appVersion', 'pushToken', 'isActive'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const device = await this.deviceService.updateDevice(req.params.id, updateData, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toDeviceDto(device));
  }

  async deactivateDevice(req, res) {
    const device = await this.deviceService.deactivateDevice(req.params.id, req.user.id, req.user.role, req.departmentId);
    return this.ok(res, toDeviceDto(device), 'Device deactivated successfully');
  }

  async toggleDeviceActive(req, res) {
    const newActiveState = req.body.isActive;
    const device = await this.deviceService.toggleDeviceActive(req.params.id, req.user.id, req.user.role, req.departmentId, newActiveState);
    return this.ok(res, toDeviceDto(device), 'Device active status updated');
  }
}

module.exports = DeviceController;
