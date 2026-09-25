/**
 * Analytics Module
 * M11 — Analytics API
 *
 * Provides analytics endpoints derived from existing data sources:
 * - Student performance and outcomes
 * - Faculty and department statistics
 * - Attendance and engagement metrics
 * - Cross-domain correlations and insights
 *
 * Integrates with:
 * - Students module (academic performance)
 * - Faculty module (teaching effectiveness)
 * - Attendance module (engagement data)
 * - Results module (assessment outcomes)
 * - Departments module (comparative data)
 * - Users module (demographic insights)
 *
 * Respects RBAC: department scope for all queries
 */

const analyticsRoutes = require('./analytics/routes');

module.exports = analyticsRoutes;
