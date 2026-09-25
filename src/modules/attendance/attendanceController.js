/**
 * Attendance Controller
 * M6 — Attendance
 *
 * Translates HTTP requests into service calls and formats canonical responses.
 * Extends BaseController for standardized response envelopes.
 */

const BaseController = require('../../controllers/baseController');
const { BadRequestError } = require('../../errors');
const { toAttendanceDto } = require('../../utils/dtoMapper');

class AttendanceController extends BaseController {
  constructor(attendanceService) {
    super(attendanceService);
    this.attendanceService = attendanceService;
  }

  async getAttendance(req, res) {
    const attendance = await this.attendanceService.getAttendance(req.params.id, req.departmentId);
    return this.ok(res, toAttendanceDto(attendance));
  }

  async getAttendances(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      studentId: req.query.studentId,
      facultyId: req.query.facultyId,
      classId: req.query.classId,
      courseId: req.query.courseId,
      status: req.query.status,
      date: req.query.date,
      search: req.query.search,
    };

    const result = await this.attendanceService.getAttendances(req.departmentId, options);
    return res.json({
      success: true,
      message: 'Attendance records retrieved',
      data: result.data.map(toAttendanceDto),
      meta: result.meta,
    });
  }

  async createAttendance(req, res) {
    const attendance = await this.attendanceService.createAttendance(req.body, req.departmentId);
    return this.created(res, toAttendanceDto(attendance));
  }

  async updateAttendance(req, res) {
    const allowedFields = ['status', 'remarks'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const attendance = await this.attendanceService.updateAttendance(req.params.id, updateData, req.departmentId);
    return this.ok(res, toAttendanceDto(attendance));
  }

  async deleteAttendance(req, res) {
    const attendance = await this.attendanceService.deleteAttendance(req.params.id, req.departmentId);
    return this.ok(res, toAttendanceDto(attendance), 'Attendance record deleted successfully');
  }
}

module.exports = AttendanceController;
