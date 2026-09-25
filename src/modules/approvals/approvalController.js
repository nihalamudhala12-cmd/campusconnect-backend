const BaseController = require('../../controllers/baseController');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../errors');
const { toApprovalDto } = require('../../utils/dtoMapper');

class ApprovalController extends BaseController {
  constructor(approvalService) {
    super(approvalService);
    this.approvalService = approvalService;
  }

  async createApproval(req, res) {
    const approval = await this.approvalService.createApproval(req.body, req.user.id, req.departmentId);
    return this.created(res, toApprovalDto(approval));
  }

  async getMyApprovals(req, res) {
    const result = await this.approvalService.getApprovals(req.user.id, req.departmentId);
    return res.json({
      success: true,
      message: 'User approvals retrieved',
      data: result.data.map(toApprovalDto),
      meta: result.meta,
    });
  }

  async getPendingApprovals(req, res) {
    const result = await this.approvalService.getPendingApprovals(req.departmentId);
    return res.json({
      success: true,
      message: 'Pending approvals retrieved',
      data: result.data.map(toApprovalDto),
      meta: result.meta,
    });
  }

  async getApproval(req, res) {
    const approval = await this.approvalService.getApproval(req.params.id, req.user.id, req.departmentId);
    return this.ok(res, toApprovalDto(approval));
  }

  async reviewApproval(req, res) {
    const updateData = {};
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }
    if (req.body.reviewedBy !== undefined) {
      updateData.reviewedBy = req.body.reviewedBy;
    }
    if (req.body.reviewedAt !== undefined) {
      updateData.reviewedAt = req.body.reviewedAt;
    }
    if (req.body.remarks !== undefined) {
      updateData.remarks = req.body.remarks;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const approval = await this.approvalService.reviewApproval(req.params.id, updateData, req.user.id, req.departmentId);
    return this.ok(res, toApprovalDto(approval));
  }

  async cancelApproval(req, res) {
    const approval = await this.approvalService.cancelApproval(req.params.id, req.user.id, req.departmentId);
    return this.ok(res, toApprovalDto(approval), 'Approval cancelled successfully');
  }
}

module.exports = ApprovalController;
