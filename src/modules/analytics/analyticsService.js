const { BaseService } = require('../../services');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../errors');
const { toAnalyticsDto } = require('../../utils/dtoMapper');

class AnalyticsService extends BaseService {
  async getStudentPerformance(departmentId, options) {
    return this.repository.getStudentPerformanceAnalytics(departmentId, options);
  }

  async getFacultyStats(departmentId, options) {
    return this.repository.getFacultyStatsAnalytics(departmentId, options);
  }

  async getAttendanceAnalytics(departmentId, options) {
    return this.repository.getAttendanceAnalytics(departmentId, options);
  }

  async getResultsAnalytics(departmentId, options) {
    return this.repository.getResultsAnalytics(departmentId, options);
  }

  async getCrossDomainAnalytics(options) {
    return this.repository.getCrossDomainAnalytics(options);
  }

  async getDepartmentComparison(departmentId, options) {
    return this.repository.getDepartmentComparisonAnalytics(departmentId, options);
  }
}

module.exports = AnalyticsService;
