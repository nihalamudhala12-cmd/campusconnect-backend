const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let systemConfigController = null;

function getController() {
  if (!systemConfigController) {
    const SystemConfigController = require('./systemConfigController');
    const SystemConfigService = require('./systemConfigService');
    const SystemConfigRepository = require('./systemConfigRepository');
    const connection = require('../../infrastructure/database/connection');
    const systemConfigRepository = new SystemConfigRepository(connection.getPool());
    const systemConfigService = new SystemConfigService(systemConfigRepository, connection);
    systemConfigController = new SystemConfigController(systemConfigService);
  }
  return systemConfigController;
}

const getSystemConfigSchema = {
  query: (query) => {
    const errors = [];
    if (query.includeSecrets !== undefined && typeof query.includeSecrets !== 'boolean') {
      errors.push({ field: 'includeSecrets', message: 'includeSecrets must be a boolean value' });
    }
    if (query.version !== undefined && typeof query.version !== 'boolean') {
      errors.push({ field: 'version', message: 'version must be a boolean value' });
    }
    return errors;
  }
};

const updateSystemConfigSchema = {
  body: (body) => {
    const errors = [];
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
      errors.push({ field: 'name', message: 'Institution name must be a non-empty string' });
    }
    if (body.academicYear !== undefined && (typeof body.academicYear !== 'string' || body.academicYear.trim().length === 0)) {
      errors.push({ field: 'academicYear', message: 'Academic year must be a non-empty string' });
    }
    if (body.timezone !== undefined && (typeof body.timezone !== 'string' || body.timezone.trim().length === 0)) {
      errors.push({ field: 'timezone', message: 'Timezone must be a non-empty string' });
    }
    if (body.language !== undefined && (typeof body.language !== 'string' || body.language.trim().length === 0)) {
      errors.push({ field: 'language', message: 'Language must be a non-empty string' });
    }
    if (body.theme !== undefined && !['LIGHT', 'DARK', 'SYSTEM'].includes(body.theme.toUpperCase())) {
      errors.push({ field: 'theme', message: 'Theme must be one of: LIGHT, DARK, SYSTEM' });
    }
    if (body.contactEmail !== undefined && (typeof body.contactEmail !== 'string' || body.contactEmail.trim().length === 0)) {
      errors.push({ field: 'contactEmail', message: 'Contact email must be a non-empty string' });
    }
    if (body.logoUrl !== undefined && (typeof body.logoUrl !== 'string' || body.logoUrl.trim().length === 0)) {
      errors.push({ field: 'logoUrl', message: 'Logo URL must be a non-empty string' });
    }
    if (body.faviconUrl !== undefined && (typeof body.faviconUrl !== 'string' || body.faviconUrl.trim().length === 0)) {
      errors.push({ field: 'faviconUrl', message: 'Favicon URL must be a non-empty string' });
    }
    return errors;
  }
};

// GET /system-config - Get current system configuration
router.get('/system-config',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(getSystemConfigSchema),
  asyncHandler(async (req, res) => {
    const includeSecrets = req.query.includeSecrets === 'true';
    const version = req.query.version === 'true';
    await getController().getSystemConfig(req, res, includeSecrets, version);
  })
);

// PUT /system-config - Update system configuration (PRINCIPAL only)
router.put('/system-config',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(updateSystemConfigSchema),
  asyncHandler(async (req, res) => {
    await getController().updateSystemConfig(req, res);
  })
);

// GET /system-config/security-info - Get security-related system information (PRINCIPAL only)
router.get('/system-config/security-info',
  authenticate,
  authorize(['PRINCIPAL']),
  asyncHandler(async (req, res) => {
    await getController().getSecurityInfo(req, res);
  })
);

// GET /system-config/health - Get system health status
router.get('/system-config/health',
  authenticate,
  asyncHandler(async (req, res) => {
    await getController().getHealthStatus(req, res);
  })
);

module.exports = router;
