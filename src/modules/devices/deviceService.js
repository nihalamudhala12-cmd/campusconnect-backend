const BaseService = require('../../services/baseService');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');

const VALID_DEVICE_TYPES = ['DESKTOP', 'MOBILE', 'TABLET', 'WEARABLE'];

class DeviceService extends BaseService {
  constructor(deviceRepository, connection) {
    super(deviceRepository);
    this.connection = connection;
  }

  async getDevices(userId, options = {}) {
    return this.repository.findByUserId(userId, options);
  }

  async getDevice(id, userId, userRole, departmentId) {
    const device = await this.repository.findById(id);
    if (!device) {
      throw new NotFoundError('Device not found');
    }
    this._enforceDepartmentScope(device, userRole, departmentId);
    if (device.user_id !== userId && userRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Cannot access device for another user');
    }
    return device;
  }

  async createDevice(data, requesterUserId, requesterRole, requesterDeptId) {
    const errors = [];
    
    if (!data.userId) errors.push({ field: 'userId', message: 'User ID is required' });
    if (!data.deviceName) errors.push({ field: 'deviceName', message: 'Device name is required' });
    if (!data.deviceType) errors.push({ field: 'deviceType', message: 'Device type is required' });
    else if (!VALID_DEVICE_TYPES.includes(data.deviceType.toUpperCase())) {
      errors.push({ field: 'deviceType', message: `Device type must be one of: ${VALID_DEVICE_TYPES.join(', ')}` });
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    if (requesterRole !== 'PRINCIPAL' && data.userId !== requesterUserId) {
      throw new ForbiddenError('Cannot create device for another user');
    }

    return this.connection.withTransaction(async (client) => {
      const device = await this.repository.create(
        {
          userId: data.userId,
          deviceName: data.deviceName,
          deviceType: data.deviceType.toUpperCase(),
          deviceModel: data.deviceModel || null,
          osVersion: data.osVersion || null,
          appVersion: data.appVersion || null,
          pushToken: data.pushToken || null,
          isActive: data.isActive || true,
        },
        client
      );
      return device;
    });
  }

  async updateDevice(id, data, userId, userRole, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Device not found');
    }

    this._enforceDepartmentScope(existing, userRole, departmentId);

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot update device for another user');
    }

    if (data.deviceType !== undefined && !VALID_DEVICE_TYPES.includes(data.deviceType.toUpperCase())) {
      throw new ValidationError('Invalid device type', [{ field: 'deviceType', message: `Device type must be one of: ${VALID_DEVICE_TYPES.join(', ')}` }]);
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(id, data, client);
      if (!updated) {
        throw new NotFoundError('Device not found during update');
      }
      return updated;
    });
  }

  async deactivateDevice(id, userId, userRole, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Device not found');
    }

    this._enforceDepartmentScope(existing, userRole, departmentId);

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot deactivate device for another user');
    }

    return this.connection.withTransaction(async (client) => {
      const deactivated = await this.repository.deactivate(id, client);
      if (!deactivated) {
        throw new NotFoundError('Device not found during deactivation');
      }
      return deactivated;
    });
  }

  async toggleDeviceActive(id, userId, userRole, departmentId, newActiveState) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Device not found');
    }

    this._enforceDepartmentScope(existing, userRole, departmentId);

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot update device for another user');
    }

    return this.connection.withTransaction(async (client) => {
      const toggled = await this.repository.toggleActive(id, newActiveState, client);
      if (!toggled) {
        throw new NotFoundError('Device not found during toggle');
      }
      return toggled;
    });
  }

  _enforceDepartmentScope(device, userRole, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (userRole === 'PRINCIPAL') {
      return;
    }
    if (device.department_id && device.department_id !== departmentId) {
      throw new ForbiddenError('Device is outside your department scope');
    }
  }
}

module.exports = DeviceService;
