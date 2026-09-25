/**
 * Department Controller
 * M2 — Departments
 */
const BaseController = require('../../controllers/baseController');
const { toDepartmentDto } = require('../../utils/dtoMapper');

class DepartmentController extends BaseController {
  constructor(service) {
    super(service);
    this.departmentService = service;
  }

  async getDepartment(req, res) {
    const dept = await this.departmentService.getDepartment(req.params.id, req.departmentId);
    return this.ok(res, toDepartmentDto(dept));
  }

  async getDepartments(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      status: req.query.status,
      search: req.query.search,
    };
    const result = await this.departmentService.getDepartments(req.departmentId, options);
    return res.json({ success: true, message: 'Departments retrieved', data: result.data.map(toDepartmentDto), meta: result.meta });
  }

  async createDepartment(req, res) {
    const dept = await this.departmentService.createDepartment(req.body, req.user.id);
    return this.created(res, toDepartmentDto(dept));
  }

  async updateDepartment(req, res) {
    const allowedFields = ['name', 'code', 'description', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    if (Object.keys(updateData).length === 0) throw new (require('../../errors').BadRequestError)('No valid fields provided for update');
    const dept = await this.departmentService.updateDepartment(req.params.id, updateData, req.departmentId);
    return this.ok(res, toDepartmentDto(dept));
  }

  async deactivateDepartment(req, res) {
    const dept = await this.departmentService.deactivateDepartment(req.params.id, req.departmentId);
    return this.ok(res, toDepartmentDto(dept), 'Department deactivated successfully');
  }
}

module.exports = DepartmentController;
