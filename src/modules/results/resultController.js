/**
 * Result Controller
 * M7 — Results
 *
 * Translates HTTP requests into service calls and formats canonical responses.
 * Extends BaseController for standardized response envelopes.
 */

const BaseController = require('../../controllers/baseController');
const { BadRequestError } = require('../../errors');
const { toResultDto } = require('../../utils/dtoMapper');

class ResultController extends BaseController {
  constructor(resultService) {
    super(resultService);
    this.resultService = resultService;
  }

  async getResult(req, res) {
    const result = await this.resultService.getResult(req.params.id, req.departmentId);
    return this.ok(res, toResultDto(result));
  }

  async getResults(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      studentId: req.query.studentId,
      courseId: req.query.courseId,
      assessmentType: req.query.assessmentType,
      semester: req.query.semester,
      academicYear: req.query.academicYear,
      status: req.query.status,
      search: req.query.search,
    };

    const result = await this.resultService.getResults(req.departmentId, options);
    return res.json({
      success: true,
      message: 'Results retrieved',
      data: result.data.map(toResultDto),
      meta: result.meta,
    });
  }

  async createResult(req, res) {
    const result = await this.resultService.createResult(req.body, req.departmentId);
    return this.created(res, toResultDto(result));
  }

  async updateResult(req, res) {
    const allowedFields = ['marksObtained', 'maxMarks', 'grade', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const result = await this.resultService.updateResult(req.params.id, updateData, req.departmentId);
    return this.ok(res, toResultDto(result));
  }

  async deleteResult(req, res) {
    const result = await this.resultService.deleteResult(req.params.id, req.departmentId);
    return this.ok(res, { id: result.id }, 'Result deleted successfully');
  }
}

module.exports = ResultController;