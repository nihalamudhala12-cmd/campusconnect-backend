/**
 * Route Registry
 * Step 6.1 — Backend Foundation
 *
 * Centralized route registry. Mounts the health check and all feature
 * module routers (users, departments, students, faculty, classes, courses,
 * timetable, attendance, results, approvals, announcements, messages,
 * chat, notifications, analytics) on the application.
 *
 * Layer Dependency Flow:
 *   App → Route Registry → Module Routers → Controllers
 *
 * Route ordering is significant: middleware-heavy routes (health,
 * users, departments) must be mounted before the catch-all 404 handler.
 */

const express = require('express');
const healthRouter = require('./health');
const authRouter = require('../modules/auth/routes');
const usersRouter = require('../modules/users/routes');
const departmentsRouter = require('../modules/departments/routes');
const studentsRouter = require('../modules/students/routes');
const facultyRouter = require('../modules/faculty/routes');
const classesRouter = require('../modules/classes/routes');
const attendanceRouter = require('../modules/attendance/routes');
const resultsRouter = require('../modules/results/routes');
const announcementsRouter = require('../modules/announcements/routes');
const messagesRouter = require('../modules/messages/routes');
const chatRouter = require('../modules/chat/routes');
const notificationsRouter = require('../modules/notifications/routes');
const approvalsRouter = require('../modules/approvals/routes');
const analyticsRouter = require('../modules/analytics/routes');
const sessionsRouter = require('../modules/sessions/routes');
const devicesRouter = require('../modules/devices/routes');
const systemConfigRouter = require('../modules/system-config/routes');
const aiRouter = require('../modules/ai/routes');

const router = express.Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/api/ai', aiRouter);
router.use(usersRouter);
router.use(departmentsRouter);
router.use(studentsRouter);
router.use(facultyRouter);
router.use(classesRouter);
router.use(attendanceRouter);
router.use(resultsRouter);
router.use(announcementsRouter);
router.use(messagesRouter);
router.use(chatRouter);
router.use(notificationsRouter);
router.use(sessionsRouter);
router.use(devicesRouter);
router.use(approvalsRouter);
router.use(analyticsRouter);
router.use(systemConfigRouter);

module.exports = {
  routeIndex: () => router,
};
