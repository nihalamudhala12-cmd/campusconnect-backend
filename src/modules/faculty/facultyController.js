/**
 * Faculty Controller
 * M4 — Faculty
 */

const BaseController = require('../../controllers/baseController');
const { BadRequestError } = require('../../errors');

class FacultyController extends BaseController {
  constructor(facultyService) {
    super(facultyService);
    this.facultyService = facultyService;
  }

  async getFaculty(req, res) {
    const faculty = await this.facultyService.getFaculty(req.params.id, req.departmentId);
    return this.ok(res, {
      id: faculty.id,
      userId: faculty.user_id,
      employeeId: faculty.employee_id,
      designation: faculty.designation,
      status: faculty.status,
      userName: faculty.user_name,
      userEmail: faculty.user_email,
      departmentId: faculty.user_department_id,
      createdAt: faculty.created_at,
    });
  }

  async getFaculties(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      status: req.query.status,
      search: req.query.search,
    };

    const result = await this.facultyService.getFaculties(req.departmentId, options);
    return res.json({
      success: true,
      message: 'Faculties retrieved',
      data: result.data.map((f) => ({
        id: f.id,
        userId: f.user_id,
        employeeId: f.employee_id,
        designation: f.designation,
        status: f.status,
        userName: f.user_name,
        userEmail: f.user_email,
        departmentId: f.user_department_id,
        createdAt: f.created_at,
      })),
      meta: result.meta,
    });
  }

  async getMyFaculty(req, res) {
    const faculty = await this.facultyService.getMyFaculty(req.user.id, req.departmentId);
    return this.ok(res, {
      id: faculty.id,
      userId: faculty.user_id,
      employeeId: faculty.employee_id,
      designation: faculty.designation,
      status: faculty.status,
    });
  }

  async createFaculty(req, res) {
    const faculty = await this.facultyService.createFaculty(req.body, req.departmentId);
    return this.created(res, {
      id: faculty.id,
      userId: faculty.user_id,
      employeeId: faculty.employee_id,
      designation: faculty.designation,
      status: faculty.status,
      createdAt: faculty.created_at,
    });
  }

  async updateFaculty(req, res) {
    const allowedFields = ['employeeId', 'designation', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const faculty = await this.facultyService.updateFaculty(req.params.id, updateData, req.departmentId);
    return this.ok(res, {
      id: faculty.id,
      userId: faculty.user_id,
      employeeId: faculty.employee_id,
      designation: faculty.designation,
      status: faculty.status,
      createdAt: faculty.created_at,
    });
  }

  async deactivateFaculty(req, res) {
    const faculty = await this.facultyService.deactivateFaculty(req.params.id, req.departmentId);
    return this.ok(res, {
      id: faculty.id,
      userId: faculty.user_id,
      status: faculty.status,
    }, 'Faculty deactivated successfully');
  }
}

module.exports = FacultyController;