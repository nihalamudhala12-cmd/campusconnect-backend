/**
 * AI Tool Registry
 * Defines the controlled set of tools available to the AI assistant.
 * Tools are read-only and map to existing CampusConnect services.
 * Each tool independently validates authorization using backend RBAC.
 * Services are lazy-loaded to avoid circular dependency issues.
 */

function getAnnouncementService() {
  return require('../announcements/announcementService');
}
function getNotificationService() {
  return require('../notifications/notificationService');
}
function getAttendanceService() {
  return require('../attendance/attendanceService');
}
function getClassService() {
  return require('../classes/classService');
}
function getResultService() {
  return require('../results/resultService');
}
function getApprovalService() {
  return require('../approvals/approvalService');
}
function getApprovalRepository() {
  return require('../approvals/approvalRepository');
}
function getConnection() {
  return require('../../infrastructure/database/connection');
}

const ToolRegistry = [
  {
    name: 'get_user_profile',
    description: 'Get authenticated user profile information',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    roleScope: ['PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'PARENT'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      return { valid: true };
    },
    execute: async (args, user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    }),
  },
  {
    name: 'get_user_department',
    description: 'Get authenticated user department information',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    roleScope: ['PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'PARENT'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      return { valid: true };
    },
    execute: async (args, user) => ({
      id: user.departmentId,
      name: user.departmentId && user.departmentId !== 'ALL' ? user.departmentId : null,
      description: 'User department context',
    }),
  },
  {
    name: 'get_user_announcements',
    description: 'Get announcements relevant to the authenticated user',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 5 },
      },
      additionalProperties: false,
    },
    roleScope: ['HOD', 'FACULTY', 'PRINCIPAL'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.limit > 50) {
        return { valid: false, message: 'Limit must not exceed 50' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const limit = args.limit || 5;
      const deptId = user.departmentId && user.departmentId !== 'ALL' ? user.departmentId : null;
      const service = getAnnouncementService();
      const result = await service.getAnnouncements(deptId, { limit });
      return result;
    },
  },
  {
    name: 'get_user_notifications',
    description: 'Get notifications for the authenticated user',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 5 },
      },
      additionalProperties: false,
    },
    roleScope: ['HOD', 'FACULTY', 'STUDENT', 'PRINCIPAL', 'PARENT'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.limit > 50) {
        return { valid: false, message: 'Limit must not exceed 50' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const limit = args.limit || 5;
      const service = getNotificationService();
      const result = await service.getNotifications({ limit, userId: user.id }, user);
      return result;
    },
  },
  {
    name: 'get_user_attendance',
    description: 'Get attendance records for the authenticated user',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
      },
      additionalProperties: false,
    },
    roleScope: ['HOD', 'FACULTY', 'PRINCIPAL'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.limit > 50) {
        return { valid: false, message: 'Limit must not exceed 50' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const limit = args.limit || 10;
      const service = getAttendanceService();
      const result = await service.getAttendances({ limit, userId: user.id }, user);
      return result;
    },
  },
  {
    name: 'get_user_classes',
    description: 'Get classes the user is enrolled in or assigned to',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
      },
      additionalProperties: false,
    },
    roleScope: ['HOD', 'FACULTY', 'PRINCIPAL'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.limit > 50) {
        return { valid: false, message: 'Limit must not exceed 50' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const limit = args.limit || 10;
      const service = getClassService();
      const result = await service.getClasses({ limit, userId: user.id }, user);
      return result;
    },
  },
  {
    name: 'get_user_results',
    description: 'Get result records for the authenticated user',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
      },
      additionalProperties: false,
    },
    roleScope: ['HOD', 'FACULTY', 'PRINCIPAL'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.limit > 50) {
        return { valid: false, message: 'Limit must not exceed 50' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const limit = args.limit || 10;
      const service = getResultService();
      const result = await service.getResults({ limit, userId: user.id }, user);
      return result;
    },
  },
  {
    name: 'get_user_approvals',
    description: 'Get approval requests accessible to the authenticated user, with optional filtering by type, status, and pagination',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
        page: { type: 'number', minimum: 1, default: 1 },
        type: { type: 'string', enum: ['LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER'] },
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] },
      },
      additionalProperties: false,
    },
    roleScope: ['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      // Reject additional properties (prevent injection of mutation fields like reviewedBy, action, etc.)
      const allowedKeys = ['limit', 'page', 'type', 'status'];
      for (const key of Object.keys(args)) {
        if (!allowedKeys.includes(key)) {
          return { valid: false, message: `Invalid parameter: ${key}` };
        }
      }
      if (args.limit !== undefined && (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 50)) {
        return { valid: false, message: 'Limit must be a number between 1 and 50' };
      }
      if (args.page !== undefined && (typeof args.page !== 'number' || args.page < 1)) {
        return { valid: false, message: 'Page must be at least 1' };
      }
      if (args.type !== undefined && !['LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER'].includes(args.type)) {
        return { valid: false, message: 'Invalid type' };
      }
      if (args.status !== undefined && !['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(args.status)) {
        return { valid: false, message: 'Status must be PENDING, APPROVED, REJECTED, or CANCELLED' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const connection = getConnection();
      const ApprovalRepository = getApprovalRepository();
      const ApprovalService = getApprovalService();
      
      const pool = connection.getPool();
      const approvalRepository = new ApprovalRepository(pool);
      const approvalService = new ApprovalService(approvalRepository, connection);
      
      const options = {
        limit: args.limit,
        page: args.page,
        type: args.type,
        status: args.status,
      };
      Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);
      
      return approvalService.getApprovals(user.id, user.departmentId, options);
    },
  },
  {
    name: 'get_pending_approvals',
    description: 'Get pending approval requests for authorized roles, with optional filtering by type and pagination',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
        page: { type: 'number', minimum: 1, default: 1 },
        type: { type: 'string', enum: ['LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER'] },
      },
      additionalProperties: false,
    },
    roleScope: ['HOD', 'FACULTY', 'PRINCIPAL'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      // Reject additional properties (prevent injection of mutation fields like action, etc.)
      const allowedKeys = ['limit', 'page', 'type'];
      for (const key of Object.keys(args)) {
        if (!allowedKeys.includes(key)) {
          return { valid: false, message: `Invalid parameter: ${key}` };
        }
      }
      if (args.limit !== undefined && (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 50)) {
        return { valid: false, message: 'Limit must be a number between 1 and 50' };
      }
      if (args.page !== undefined && (typeof args.page !== 'number' || args.page < 1)) {
        return { valid: false, message: 'Page must be at least 1' };
      }
      if (args.type !== undefined && !['LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER'].includes(args.type)) {
        return { valid: false, message: 'Invalid type' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const connection = getConnection();
      const ApprovalRepository = getApprovalRepository();
      const ApprovalService = getApprovalService();
      
      const pool = connection.getPool();
      const approvalRepository = new ApprovalRepository(pool);
      const approvalService = new ApprovalService(approvalRepository, connection);
      
      const options = {
        limit: args.limit,
        page: args.page,
        type: args.type,
      };
      Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);
      
      return approvalService.getPendingApprovals(user.departmentId, options);
    },
  },
  {
    name: 'get_departments',
    description: 'Get list of departments accessible to the user',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        page: { type: 'number', minimum: 1, default: 1 },
        search: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
      },
      additionalProperties: false,
    },
    roleScope: ['PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'PARENT'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.limit > 100) {
        return { valid: false, message: 'Limit must not exceed 100' };
      }
      if (args.page < 1) {
        return { valid: false, message: 'Page must be at least 1' };
      }
      if (args.status && !['ACTIVE', 'INACTIVE'].includes(args.status)) {
        return { valid: false, message: 'Status must be either ACTIVE or INACTIVE' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      // Get department ID from user context
      const departmentId = user.departmentId || null;
      
      // Prepare options for the service call
      const options = {
        limit: args.limit,
        page: args.page,
        search: args.search,
        status: args.status,
      };
      
      // Remove undefined values from options
      Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);
      
      // Import required modules
      const connection = require('../../infrastructure/database/connection');
      const DepartmentRepository = require('../departments/departmentRepository');
      const DepartmentService = require('../departments/departmentService');
      
      // Get database connection pool
      const pool = connection.getPool();
      
      // Create repository and service instances
      const repo = new DepartmentRepository(pool);
      const service = new DepartmentService(repo, connection);
      
      // Call the service method
      const result = await service.getDepartments(departmentId, options);
      
      return result;
    },
  },
  {
    name: 'get_user_messages',
    description: 'Get messages for the authenticated user with pagination',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
        page: { type: 'number', minimum: 1, default: 1 },
        senderId: { type: 'string' },
        receiverId: { type: 'string' },
        isRead: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    // STUDENT is included because the AI context permission model
    // (aiContextBuilder._getRolePermissions) grants STUDENT
    // `messages: { view: true }`, matching GET /messages (module: messages)
    // and the frontend RolesAndPermissions map. PARENT remains excluded,
    // which is the documented fail-closed decision.
    roleScope: ['PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.limit !== undefined && (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 50)) {
        return { valid: false, message: 'Limit must be a number between 1 and 50' };
      }
      if (args.page !== undefined && (typeof args.page !== 'number' || args.page < 1)) {
        return { valid: false, message: 'Page must be at least 1' };
      }
      if (args.senderId !== undefined && (typeof args.senderId !== 'string' || args.senderId.trim().length === 0)) {
        return { valid: false, message: 'senderId must be a non-empty string' };
      }
      if (args.receiverId !== undefined && (typeof args.receiverId !== 'string' || args.receiverId.trim().length === 0)) {
        return { valid: false, message: 'receiverId must be a non-empty string' };
      }
      if (args.isRead !== undefined && typeof args.isRead !== 'boolean') {
        return { valid: false, message: 'isRead must be a boolean' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const MessageService = require('../messages/messageService');
      const connection = require('../../infrastructure/database/connection');
      const MessageRepository = require('../messages/messageRepository');
      
      const messageRepository = new MessageRepository(connection.getPool());
      const messageService = new MessageService(messageRepository, connection);
      
      const options = {
        limit: args.limit,
        page: args.page,
        senderId: args.senderId,
        receiverId: args.receiverId,
        isRead: args.isRead,
      };
      
      const result = await messageService.getMessages(user.id, user.departmentId, options);
      return result;
    },
  },
  {
    name: 'get_user_analytics',
    description: 'Get analytics data for the authenticated user based on role and department permissions',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        page: { type: 'number', minimum: 1, default: 1 },
        metric: { type: 'string', enum: ['ATTENDANCE', 'RESULTS', 'STUDENT_PERFORMANCE', 'FACULTY_STATS'] },
        semester: { type: 'string' },
        academicYear: { type: 'string' },
      },
      additionalProperties: false,
    },
    roleScope: ['PRINCIPAL', 'HOD', 'FACULTY'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      // Reject user-supplied identity/authorization parameters
      if (args.userId !== undefined || args.studentId !== undefined || args.facultyId !== undefined) {
        return { valid: false, message: 'Identity parameters must come from authenticated context' };
      }
      if (args.departmentId !== undefined) {
        return { valid: false, message: 'Department ID must come from authenticated context, not request parameters' };
      }
      if (args.role !== undefined || args.permission !== undefined || args.scope !== undefined) {
        return { valid: false, message: 'Authorization parameters must come from authenticated context' };
      }
// Validate metric availability based on user role
      if (args.metric !== undefined) {
        const availableMetrics = {
          PRINCIPAL: ['ATTENDANCE', 'RESULTS', 'STUDENT_PERFORMANCE', 'FACULTY_STATS'],
          HOD: ['ATTENDANCE', 'RESULTS', 'STUDENT_PERFORMANCE', 'FACULTY_STATS'],
          FACULTY: ['ATTENDANCE', 'RESULTS', 'STUDENT_PERFORMANCE', 'FACULTY_STATS'],
        };
        const allowedMetrics = availableMetrics[user.role] || [];
        if (!allowedMetrics.includes(args.metric)) {
          return { valid: false, message: `Metric \'${args.metric}\' is not available for role ${user.role}` };
        }
      }
      if (args.limit !== undefined && (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 50)) {
        return { valid: false, message: 'Limit must be a number between 1 and 50' };
      }
      if (args.page !== undefined && (typeof args.page !== 'number' || args.page < 1)) {
        return { valid: false, message: 'Page must be at least 1' };
      }
      if (args.semester !== undefined && typeof args.semester !== 'string') {
        return { valid: false, message: 'Semester must be a string' };
      }
      if (args.academicYear !== undefined && typeof args.academicYear !== 'string') {
        return { valid: false, message: 'Academic year must be a string' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const AnalyticsRepository = require('../analytics/analyticsRepository');
      const AnalyticsService = require('../analytics/analyticsService');
      const connection = require('../../infrastructure/database/connection');
      const pool = connection.getPool();
      const analyticsRepository = new AnalyticsRepository(pool);
      const analyticsService = new AnalyticsService(analyticsRepository, connection);

      // Use only authenticated user context - never trust AI-supplied identity parameters
      const departmentId = user.departmentId && user.departmentId !== 'ALL' ? user.departmentId : 'ALL';
      const options = {
        limit: args.limit,
        page: args.page,
        semester: args.semester,
        academicYear: args.academicYear,
      };
      Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);
      let result;
      switch (args.metric) {
        case 'ATTENDANCE':
          result = await analyticsService.getAttendanceAnalytics(departmentId, options);
          break;
        case 'RESULTS':
          result = await analyticsService.getResultsAnalytics(departmentId, options);
          break;
        case 'STUDENT_PERFORMANCE':
          result = await analyticsService.getStudentPerformance(departmentId, options);
          break;
        case 'FACULTY_STATS':
          result = await analyticsService.getFacultyStats(departmentId, options);
          break;
        default:
          throw new Error('Invalid metric specified');
      }
      return result;
    },
  },
  {
    name: 'get_analytics_data',
    description: 'Get analytics data using the existing AnalyticsService without direct DB access',
    parameters: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['ATTENDANCE', 'RESULTS', 'STUDENT_PERFORMANCE', 'FACULTY_STATS'] },
        departmentId: { type: 'string' },
        options: { type: 'object' },
      },
      additionalProperties: false,
    },
    roleScope: ['PRINCIPAL', 'HOD', 'FACULTY'],
    validate: (args, user) => {
      if (!user) {
        return { valid: false, message: 'User not authenticated' };
      }
      if (args.metric !== undefined && !['ATTENDANCE', 'RESULTS', 'STUDENT_PERFORMANCE', 'FACULTY_STATS'].includes(args.metric)) {
        return { valid: false, message: 'Invalid metric' };
      }
      if (args.departmentId !== undefined) {
        return { valid: false, message: 'Department ID must come from authenticated context, not request parameters' };
      }
      return { valid: true };
    },
    execute: async (args, user) => {
      const connection = require('../../infrastructure/database/connection');
      const AnalyticsRepository = require('../analytics/analyticsRepository');
      const AnalyticsService = require('../analytics/analyticsService');
      const pool = connection.getPool();
      const analyticsRepository = new AnalyticsRepository(pool);
      const analyticsService = new AnalyticsService(analyticsRepository, connection);
      
      const departmentId = user.departmentId && user.departmentId !== 'ALL' ? user.departmentId : 'ALL';
      const options = args.options || {};
      
      switch (args.metric) {
        case 'ATTENDANCE':
          return await analyticsService.getAttendanceAnalytics(departmentId, options);
        case 'RESULTS':
          return await analyticsService.getResultsAnalytics(departmentId, options);
        case 'STUDENT_PERFORMANCE':
          return await analyticsService.getStudentPerformance(departmentId, options);
        case 'FACULTY_STATS':
          return await analyticsService.getFacultyStats(departmentId, options);
        default:
          throw new Error('Invalid metric specified');
      }
    },
  },
];

function getToolsForRole(role) {
  return ToolRegistry.filter((tool) => {
    if (role === 'PRINCIPAL') {
      return true;
    }
    const allowedRoles = tool.roleScope || [];
    return allowedRoles.indexOf(role) !== -1;
  });
}

module.exports = { ToolRegistry, getToolsForRole };