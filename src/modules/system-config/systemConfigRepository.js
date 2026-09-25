const BaseRepository = require('../../repositories/baseRepository');

class SystemConfigRepository extends BaseRepository {
  async getSystemConfig(client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT 
         name, academic_year as academicYear, timezone, language, theme,
         contact_email as contactEmail, logo_url as logoUrl, favicon_url as faviconUrl,
         secondary_color as secondaryColor, welcome_message as welcomeMessage,
         footer_text as footerText, enable_notifications as enableNotifications,
         notification_email as notificationEmail, max_file_upload_size as maxFileUploadSize,
         allowed_file_types as allowedFileTypes, session_timeout as sessionTimeout,
         password_policy as passwordPolicy, created_at, updated_at, created_by
       FROM system_config
       WHERE is_deleted = false`,
      []
    );
    return result.rows[0] || null;
  }

  async updateSystemConfig(data, userId, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.getSystemConfig(client);
    
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    const fieldMappings = {
      name: 'name',
      academicYear: 'academic_year',
      timezone: 'timezone',
      language: 'language',
      theme: 'theme',
      contactEmail: 'contact_email',
      logoUrl: 'logo_url',
      faviconUrl: 'favicon_url',
      secondaryColor: 'secondary_color',
      welcomeMessage: 'welcome_message',
      footerText: 'footer_text',
      enableNotifications: 'enable_notifications',
      notificationEmail: 'notification_email',
      maxFileUploadSize: 'max_file_upload_size',
      allowedFileTypes: 'allowed_file_types',
      sessionTimeout: 'session_timeout',
      passwordPolicy: 'password_policy'
    };

    for (const [dataKey, dbColumn] of Object.entries(fieldMappings)) {
      if (data[dataKey] !== undefined) {
        setClauses.push(`${dbColumn} = $${paramIndex++}`);
        params.push(data[dataKey]);
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(userId);
    const userIdIndex = paramIndex;

    const result = await runner.query(
      `UPDATE system_config 
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE is_deleted = false
       AND created_by = $${userIdIndex}
       RETURNING 
         name, academic_year as academicYear, timezone, language, theme,
         contact_email as contactEmail, logo_url as logoUrl, favicon_url as faviconUrl,
         secondary_color as secondaryColor, welcome_message as welcomeMessage,
         footer_text as footerText, enable_notifications as enableNotifications,
         notification_email as notificationEmail, max_file_upload_size as maxFileUploadSize,
         allowed_file_types as allowedFileTypes, session_timeout as sessionTimeout,
         password_policy as passwordPolicy, created_at, updated_at, created_by`,
       params
    );
    return result.rows[0] || null;
  }

  async getSecurityInfo(client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT 
         max_file_upload_size as maxFileUploadSize,
         allowed_file_types as allowedFileTypes,
         session_timeout as sessionTimeout,
         CASE WHEN password_policy IS NOT NULL THEN 'CUSTOM' ELSE 'STANDARD' END as passwordPolicyType,
         created_at as systemCreatedAt,
         updated_at as systemLastUpdated
       FROM system_config
       WHERE is_deleted = false`,
      []
    );
    return result.rows[0] || null;
  }

  async getHealthStatus(client = null) {
    const runner = this.getRunner(client);
    const result = await runner.query(
      `SELECT 
         'ok' as status,
         NOW() as timestamp,
         current_database() as databaseName,
         version() as databaseVersion
       FROM pg_stat_activity
       WHERE pid = pg_backend_pid()
       LIMIT 1`,
       []
    );
    return result.rows[0] || null;
  }

  async initializeSystemConfig(userId, client = null) {
    const runner = this.getRunner(client);
    const existing = await this.getSystemConfig(client);
    
    if (existing) {
      return existing;
    }

    const result = await runner.query(
      `INSERT INTO system_config (
         id, name, academic_year, timezone, language, theme,
         contact_email, logo_url, favicon_url, secondary_color,
         welcome_message, footer_text, enable_notifications,
         notification_email, max_file_upload_size, allowed_file_types,
         session_timeout, password_policy, created_at, updated_at,
         created_by, is_deleted
       ) VALUES (
         gen_random_uuid(),
         'CampusConnect System',
         '2025-2026',
         'UTC',
         'EN',
         'SYSTEM',
         'admin@university.edu',
         null,
         null,
         '#3B82F6',
         'Welcome to CampusConnect',
         '© 2025 CampusConnect System. All rights reserved.',
         true,
         'notifications@university.edu',
         10485760,
         '["pdf", "doc", "docx", "jpg", "png"]'::jsonb,
         3600,
         '{"minLength": 8, "requireSpecial": true, "requireNumber": true, "requireUppercase": true, "requireLowercase": true, "maxAge": 90}'::jsonb,
         NOW(),
         NOW(),
         $1,
         false
       )
       RETURNING 
         name, academic_year as academicYear, timezone, language, theme,
         contact_email as contactEmail, logo_url as logoUrl, favicon_url as faviconUrl,
         secondary_color as secondaryColor, welcome_message as welcomeMessage,
         footer_text as footerText, enable_notifications as enableNotifications,
         notification_email as notificationEmail, max_file_upload_size as maxFileUploadSize,
         allowed_file_types as allowedFileTypes, session_timeout as sessionTimeout,
         password_policy as passwordPolicy, created_at, updated_at, created_by`,
       [userId]
    );
    return result.rows[0] || null;
  }
}

module.exports = SystemConfigRepository;
