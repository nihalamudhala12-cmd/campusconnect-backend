const BaseController = require('../../controllers/baseController');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');
const { toSystemConfigDto } = require('../../utils/dtoMapper');

class SystemConfigController extends BaseController {
  constructor(systemConfigService) {
    super(systemConfigService);
    this.systemConfigService = systemConfigService;
  }

  async getSystemConfig(req, res, includeSecrets, version) {
    const systemConfig = await this.systemConfigService.getSystemConfig(includeSecrets, version, req.user.id);
    return this.ok(res, toSystemConfigDto(systemConfig));
  }

  async updateSystemConfig(req, res) {
    const configData = {};
    const allowedFields = [
      'name', 'academicYear', 'timezone', 'language', 'theme',
      'contactEmail', 'logoUrl', 'faviconUrl', 'secondaryColor',
      'welcomeMessage', 'footerText', 'enableNotifications',
      'notificationEmail', 'maxFileUploadSize', 'allowedFileTypes',
      'sessionTimeout', 'passwordPolicy'
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        configData[field] = req.body[field];
      }
    }

    if (Object.keys(configData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const updatedConfig = await this.systemConfigService.updateSystemConfig(configData, req.user.id);
    return this.ok(res, toSystemConfigDto(updatedConfig), 'System configuration updated successfully');
  }

  async getSecurityInfo(req, res) {
    const securityInfo = await this.systemConfigService.getSecurityInfo();
    return this.ok(res, securityInfo);
  }

  async getHealthStatus(req, res) {
    const healthStatus = await this.systemConfigService.getHealthStatus();
    return this.ok(res, healthStatus);
  }
}

module.exports = SystemConfigController;
