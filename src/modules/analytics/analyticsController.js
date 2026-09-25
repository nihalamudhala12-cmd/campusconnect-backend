const BaseController = require('../../controllers/baseController');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../errors');
const { toAnalyticsDto } = require('../../utils/dtoMapper');

class AnalyticsController extends BaseController {
  constructor(analyticsService) {
    super(analyticsService);
    this.analyticsService = analyticsService;
  }

  async getStudentPerformance(req, res) {
    const result = await this.analyticsService.getStudentPerformance(req.departmentId, req.query);
    return res.json({
      success: true,
      message: 'Student performance analytics retrieved',
      data: result.data.map(toAnalyticsDto),
      meta: result.meta,
    });
  }

  async getFacultyStats(req, res) {
    const result = await this.analyticsService.getFacultyStats(req.departmentId, req.query);
    return res.json({
      success: true,
      message: 'Faculty statistics analytics retrieved',
      data: result.data.map(toAnalyticsDto),
      meta: result.meta,
    });
  }

  async getAttendanceAnalytics(req, res) {
    const result = await this.analyticsService.getAttendanceAnalytics(req.departmentId, req.query);
    return res.json({
      success: true,
      message: 'Attendance analytics retrieved',
      data: result.data.map(toAnalyticsDto),
      meta: result.meta,
    });
  }

  async getResultsAnalytics(req, res) {
    const result = await this.analyticsService.getResultsAnalytics(req.departmentId, req.query);
    return res.json({
      success: true,
      message: 'Results analytics retrieved',
      data: result.data.map(toAnalyticsDto),
      meta: result.meta,
    });
  }

  async getCrossDomainAnalytics(req, res) {
    const result = await this.analyticsService.getCrossDomainAnalytics(req.query);
    return res.json({
      success: true,
      message: 'Cross-domain analytics retrieved',
      data: result.data.map(toAnalyticsDto),
      meta: result.meta,
    });
  }

  async getDepartmentComparison(req, res) {
    const result = await this.analyticsService.getDepartmentComparison(req.departmentId, req.query);
    return res.json({
      success: true,
      message: 'Department comparison analytics retrieved',
      data: result.data.map(toAnalyticsDto),
      meta: result.meta,
    });
  }
}

module.exports = AnalyticsController;
