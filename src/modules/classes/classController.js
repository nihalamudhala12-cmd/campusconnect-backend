/**
 * Class Controller
 * M5 — Classes
 *
 * Translates HTTP requests into service calls and formats canonical responses.
 * Extends BaseController for standardized response envelopes.
 */

const BaseController = require('../../controllers/baseController');
const { BadRequestError } = require('../../errors');
const { toClassDto } = require('../../utils/dtoMapper');

class ClassController extends BaseController {
  constructor(classService) {
    super(classService);
    this.classService = classService;
  }

  async getClass(req, res) {
    const cls = await this.classService.getClass(req.params.id, req.departmentId);
    return this.ok(res, toClassDto(cls));
  }

  async getClasses(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      status: req.query.status,
      semester: req.query.semester,
      search: req.query.search,
    };

    const result = await this.classService.getClasses(req.departmentId, options);
    return res.json({
      success: true,
      message: 'Classes retrieved',
      data: result.data.map(toClassDto),
      meta: result.meta,
    });
  }

  async createClass(req, res) {
    const cls = await this.classService.createClass(req.body, req.departmentId);
    return this.created(res, toClassDto(cls));
  }

  async updateClass(req, res) {
    const allowedFields = ['name', 'code', 'departmentId', 'semester', 'section', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const cls = await this.classService.updateClass(req.params.id, updateData, req.departmentId);
    return this.ok(res, toClassDto(cls));
  }

  async deactivateClass(req, res) {
    const cls = await this.classService.deactivateClass(req.params.id, req.departmentId);
    return this.ok(res, toClassDto(cls), 'Class deactivated successfully');
  }
}

module.exports = ClassController;