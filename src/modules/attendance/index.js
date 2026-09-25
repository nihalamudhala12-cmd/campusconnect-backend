/**
 * Attendance Module
 * M6 — Attendance
 *
 * Registers the Attendance feature module with the module system.
 */

const AttendanceRepository = require('./attendanceRepository');
const AttendanceService = require('./attendanceService');
const AttendanceController = require('./attendanceController');
const attendanceRoutes = require('./routes');

function createAttendanceModule(connection) {
  const attendanceRepository = new AttendanceRepository(connection.getPool());
  const attendanceService = new AttendanceService(attendanceRepository, connection);
  const attendanceController = new AttendanceController(attendanceService);

  return {
    router: attendanceRoutes,
    repository: attendanceRepository,
    service: attendanceService,
    controller: attendanceController,
  };
}

module.exports = {
  createAttendanceModule,
  attendanceRoutes,
  AttendanceRepository,
  AttendanceService,
  AttendanceController,
};
