const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let analyticsController = null;

function getController() {
  if (!analyticsController) {
    const AnalyticsController = require('./analyticsController');
    const AnalyticsService = require('./analyticsService');
    const AnalyticsRepository = require('./analyticsRepository');
    const connection = require('../../infrastructure/database/connection');
    const analyticsRepository = new AnalyticsRepository(connection.getPool());
    const analyticsService = new AnalyticsService(analyticsRepository, connection);
    analyticsController = new AnalyticsController(analyticsService);
  }
  return analyticsController;
}

const studentPerformanceSchema = {
  query: require('./analyticsValidator').validateStudentPerformanceQuery,
};

const facultyStatsSchema = {
  query: require('./analyticsValidator').validateFacultyStatsQuery,
};

const attendanceSchema = {
  query: require('./analyticsValidator').validateAttendanceQuery,
};

const resultsSchema = {
  query: require('./analyticsValidator').validateResultsQuery,
};

const crossDomainSchema = {
  query: require('./analyticsValidator').validateCrossDomainQuery,
};

// Student performance analytics - HOD, FACULTY, PRINCIPAL
router.get('/analytics/student-performance',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(studentPerformanceSchema),
  asyncHandler(async (req, res) => {
    await getController().getStudentPerformance(req, res);
  })
);

// Faculty effectiveness analytics - HOD, FACULTY, PRINCIPAL
router.get('/analytics/faculty-stats',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(facultyStatsSchema),
  asyncHandler(async (req, res) => {
    await getController().getFacultyStats(req, res);
  })
);

// Attendance analytics - HOD, FACULTY, PRINCIPAL
router.get('/analytics/attendance',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(attendanceSchema),
  asyncHandler(async (req, res) => {
    await getController().getAttendanceAnalytics(req, res);
  })
);

// Results analytics - HOD, FACULTY, PRINCIPAL
router.get('/analytics/results',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(resultsSchema),
  asyncHandler(async (req, res) => {
    await getController().getResultsAnalytics(req, res);
  })
);

// Cross-domain analytics - PRINCIPAL only
router.get('/analytics/cross-domain',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(crossDomainSchema),
  asyncHandler(async (req, res) => {
    await getController().getCrossDomainAnalytics(req, res);
  })
);

// Department comparison analytics - HOD, FACULTY, PRINCIPAL
router.get('/analytics/department-comparison',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(crossDomainSchema),
  asyncHandler(async (req, res) => {
    await getController().getDepartmentComparison(req, res);
  })
);

module.exports = router;
