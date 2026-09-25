/**
 * Student Controller
 * M3 — Students
 *
 * Translates HTTP requests into service calls and formats canonical responses.
 * Extends BaseController for standardized response envelopes.
 */

const BaseController = require('../../controllers/baseController');
const { ValidationError, BadRequestError } = require('../../errors');
const { toUserDto } = require('../../utils/dtoMapper');

class StudentController extends BaseController {
  constructor(studentService) {
    super(studentService);
    this.studentService = studentService;
  }

  async getStudent(req, res) {
    const student = await this.studentService.getStudent(req.params.id, req.departmentId);
    return this.ok(res, {
      id: student.id,
      userId: student.user_id,
      rollNumber: student.roll_number,
      admissionNumber: student.admission_number,
      semester: student.semester,
      status: student.status,
      userName: student.user_name,
      userEmail: student.user_email,
      departmentId: student.user_department_id,
      createdAt: student.created_at,
    });
  }

  async getStudents(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      status: req.query.status,
      semester: req.query.semester,
      classId: req.query.classId,
      search: req.query.search,
      userId: req.query.userId,
    };

    const result = await this.studentService.getStudents(req.departmentId, options);
    return res.json({
      success: true,
      message: 'Students retrieved',
      data: result.data.map((s) => ({
        id: s.id,
        userId: s.user_id,
        rollNumber: s.roll_number,
        admissionNumber: s.admission_number,
        semester: s.semester,
        status: s.status,
        userName: s.user_name,
        userEmail: s.user_email,
        departmentId: s.user_department_id,
        createdAt: s.created_at,
      })),
      meta: result.meta,
    });
  }

  async getMyStudent(req, res) {
    const student = await this.studentService.getMyStudent(req.user.id, req.departmentId);
    return this.ok(res, {
      id: student.id,
      userId: student.user_id,
      rollNumber: student.roll_number,
      admissionNumber: student.admission_number,
      semester: student.semester,
      status: student.status,
      userName: student.user_name,
      userEmail: student.user_email,
      departmentId: student.user_department_id,
      createdAt: student.created_at,
    });
  }

  async createStudent(req, res) {
    const student = await this.studentService.createStudent(req.body, req.departmentId);
    return this.created(res, {
      id: student.id,
      userId: student.user_id,
      rollNumber: student.roll_number,
      admissionNumber: student.admission_number,
      semester: student.semester,
      status: student.status,
      createdAt: student.created_at,
    });
  }

  async updateStudent(req, res) {
    const allowedFields = ['rollNumber', 'admissionNumber', 'semester', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const student = await this.studentService.updateStudent(req.params.id, updateData, req.departmentId);
    return this.ok(res, {
      id: student.id,
      userId: student.user_id,
      rollNumber: student.roll_number,
      admissionNumber: student.admission_number,
      semester: student.semester,
      status: student.status,
      createdAt: student.created_at,
    });
  }

  async deactivateStudent(req, res) {
    const student = await this.studentService.deactivateStudent(req.params.id, req.departmentId);
    return this.ok(res, {
      id: student.id,
      userId: student.user_id,
      status: student.status,
    }, 'Student deactivated successfully');
  }
}

module.exports = StudentController;