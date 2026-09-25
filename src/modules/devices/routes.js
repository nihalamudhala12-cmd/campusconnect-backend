const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let deviceController = null;

function getController() {
  if (!deviceController) {
    const DeviceController = require('./deviceController');
    const DeviceService = require('./deviceService');
    const DeviceRepository = require('./deviceRepository');
    const connection = require('../../infrastructure/database/connection');
    const deviceRepository = new DeviceRepository(connection.getPool());
    const deviceService = new DeviceService(deviceRepository, connection);
    deviceController = new DeviceController(deviceService);
  }
  return deviceController;
}

const createDeviceSchema = {
  body: (body) => {
    const errors = [];
    if (!body || typeof body.userId !== 'string' || body.userId.trim().length === 0) {
      errors.push({ field: 'userId', message: 'User ID is required' });
    }
    if (!body || typeof body.deviceName !== 'string' || body.deviceName.trim().length === 0) {
      errors.push({ field: 'deviceName', message: 'Device name is required' });
    }
    if (!body || typeof body.deviceType !== 'string' || body.deviceType.trim().length === 0) {
      errors.push({ field: 'deviceType', message: 'Device type is required' });
    }
    if (body.deviceType && !['DESKTOP', 'MOBILE', 'TABLET', 'WEARABLE'].includes(body.deviceType.toUpperCase())) {
      errors.push({ field: 'deviceType', message: 'Device type must be one of: DESKTOP, MOBILE, TABLET, WEARABLE' });
    }
    return errors;
  }
};

const updateDeviceSchema = {
  body: (body) => {
    const errors = [];
    if (body.deviceName !== undefined && (typeof body.deviceName !== 'string' || body.deviceName.trim().length === 0)) {
      errors.push({ field: 'deviceName', message: 'Device name must be a non-empty string' });
    }
    if (body.deviceType !== undefined && !['DESKTOP', 'MOBILE', 'TABLET', 'WEARABLE'].includes(body.deviceType.toUpperCase())) {
      errors.push({ field: 'deviceType', message: 'Device type must be one of: DESKTOP, MOBILE, TABLET, WEARABLE' });
    }
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      errors.push({ field: 'isActive', message: 'isActive must be a boolean value' });
    }
    return errors;
  }
};

const toggleActiveSchema = {
  body: (body) => {
    const errors = [];
    if (body.isActive === undefined || body.isActive === null) {
      errors.push({ field: 'isActive', message: 'isActive is required' });
    } else if (typeof body.isActive !== 'boolean') {
      errors.push({ field: 'isActive', message: 'isActive must be a boolean value' });
    }
    return errors;
  }
};

const listDevicesSchema = {
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
    return errors;
  }
};

const deviceIdSchema = {
  params: (params) => {
    const errors = [];
    if (!params.id) {
      errors.push({ field: 'id', message: 'Device ID is required' });
      return errors;
    }
    const { validateUUID } = require('../../utils/idMapper');
    if (!validateUUID(params.id)) {
      errors.push({ field: 'id', message: 'Device ID must be a valid UUID' });
    }
    return errors;
  }
};

// GET /devices - List devices for current user (admin only)
router.get('/devices',
  authenticate,
  authorize(['PRINCIPAL', 'HOD']),
  validateRequest(listDevicesSchema),
  asyncHandler(async (req, res) => {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    };
    await getController().getDevices(req, res, options);
  })
);

// GET /devices/:id - Get specific device
router.get('/devices/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(deviceIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getDevice(req, res);
  })
);

// POST /devices - Register new device
router.post('/devices',
  authenticate,
  validateRequest(createDeviceSchema),
  asyncHandler(async (req, res) => {
    await getController().createDevice(req, res);
  })
);

// PUT /devices/:id - Update device
router.put('/devices/:id',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(deviceIdSchema),
  validateRequest(updateDeviceSchema),
  asyncHandler(async (req, res) => {
    await getController().updateDevice(req, res);
  })
);

// DELETE /devices/:id - Deactivate device
router.delete('/devices/:id',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(deviceIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deactivateDevice(req, res);
  })
);

// PATCH /devices/:id/active - Toggle device active status
router.patch('/devices/:id/active',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(deviceIdSchema),
  validateRequest(toggleActiveSchema),
  asyncHandler(async (req, res) => {
    await getController().toggleDeviceActive(req, res);
  })
);

module.exports = router;
