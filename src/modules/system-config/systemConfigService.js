const BaseService = require('../../services/baseService');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');

class SystemConfigService extends BaseService {
  constructor(systemConfigRepository, connection) {
    super(systemConfigRepository);
    this.connection = connection;
  }

  async getSystemConfig(includeSecrets = false, version = false, userId = null) {
    let config = await this.repository.getSystemConfig();
    if (!config) {
      if (userId) {
        config = await this.repository.initializeSystemConfig(userId);
      }
      if (!config) {
        throw new NotFoundError('System configuration not found');
      }
    }

    if (!includeSecrets) {
      return {
        name: config.name,
        academicYear: config.academicYear,
        timezone: config.timezone,
        language: config.language,
        theme: config.theme,
        contactEmail: config.contactEmail,
        logoUrl: config.logoUrl,
        faviconUrl: config.faviconUrl,
        secondaryColor: config.secondaryColor,
        welcomeMessage: config.welcomeMessage,
        footerText: config.footerText,
        enableNotifications: config.enableNotifications,
        notificationEmail: config.notificationEmail,
        maxFileUploadSize: config.maxFileUploadSize,
        allowedFileTypes: config.allowedFileTypes,
        sessionTimeout: config.sessionTimeout,
        passwordPolicy: config.passwordPolicy,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    }

    return config;
  }

  async updateSystemConfig(data, userId) {
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new ValidationError('Validation failed', [{ field: 'name', message: 'Institution name cannot be empty' }]);
    }

    if (data.academicYear !== undefined && data.academicYear.trim().length === 0) {
      throw new ValidationError('Validation failed', [{ field: 'academicYear', message: 'Academic year cannot be empty' }]);
    }

    if (data.timezone !== undefined && data.timezone.trim().length === 0) {
      throw new ValidationError('Validation failed', [{ field: 'timezone', message: 'Timezone cannot be empty' }]);
    }

    if (data.language !== undefined && data.language.trim().length === 0) {
      throw new ValidationError('Validation failed', [{ field: 'language', message: 'Language cannot be empty' }]);
    }

    if (data.theme !== undefined && !['LIGHT', 'DARK', 'SYSTEM'].includes(data.theme.toUpperCase())) {
      throw new ValidationError('Validation failed', [{ field: 'theme', message: 'Theme must be one of: LIGHT, DARK, SYSTEM' }]);
    }

    if (data.contactEmail !== undefined && data.contactEmail.trim().length === 0) {
      throw new ValidationError('Validation failed', [{ field: 'contactEmail', message: 'Contact email cannot be empty' }]);
    }

    return this.connection.withTransaction(async (client) => {
      const updatedConfig = await this.repository.updateSystemConfig(data, userId, client);
      if (!updatedConfig) {
        throw new NotFoundError('System configuration not found or insufficient permissions');
      }
      return updatedConfig;
    });
  }

  async getSecurityInfo() {
    return await this.repository.getSecurityInfo();
  }

  async getHealthStatus() {
    return await this.repository.getHealthStatus();
  }

  async initializeIfNotExists(userId) {
    await this.connection.withTransaction(async (client) => {
      await this.repository.initializeSystemConfig(userId, client);
    });
  }
}

module.exports = SystemConfigService;
