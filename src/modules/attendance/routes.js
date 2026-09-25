/**
 * Attendance Routes
 * M6 — Attendance
 */

const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const {
  validateCreateAttendance,
  validateUpdateAttendance,
  validateListAttendanceQuery,
  validateAttendanceIdParam,
} = require('./attendanceValidator');

const router = Router();

let attendanceController = null;
function getController() {
  if (!attendanceController) {
    const AttendanceController = require('./attendanceController');
    const AttendanceService = require('./attendanceService');
    const AttendanceRepository = require('./attendanceRepository');
    const connection = require('../../infrastructure/database/connection');
    const repo = new AttendanceRepository(connection.getPool());
    const service = new AttendanceService(repo, connection);
    attendanceController = new AttendanceController(service);
  }
  return attendanceController;
}

const createAttendanceSchema = {
  body: validateCreateAttendance,
};

const updateAttendanceSchema = {
  body: validateUpdateAttendance,
};

const listAttendanceSchema = {
  query: validateListAttendanceQuery,
};

const attendanceIdSchema = {
  params: validateAttendanceIdParam,
};

router.get('/attendance',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(listAttendanceSchema),
  asyncHandler(async (req, res) => {
    await getController().getAttendances(req, res);
  })
);

router.get('/attendance/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(attendanceIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getAttendance(req, res);
  })
);

router.post('/attendance',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(createAttendanceSchema),
  asyncHandler(async (req, res) => {
    await getController().createAttendance(req, res);
  })
);

router.put('/attendance/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(attendanceIdSchema),
  validateRequest(updateAttendanceSchema),
  asyncHandler(async (req, res) => {
    await getController().updateAttendance(req, res);
  })
);

router.delete('/attendance/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(attendanceIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deleteAttendance(req, res);
  })
);

module.exports = router;
