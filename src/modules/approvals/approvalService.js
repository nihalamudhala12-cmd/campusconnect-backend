const { BaseService } = require('../../services');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../errors');
const { toApprovalDto } = require('../../utils/dtoMapper');

class ApprovalService extends BaseService {
  constructor(approvalRepository, connection) {
    super(approvalRepository);
    this.connection = connection;
  }

  async getApproval(id, requestingUserId, departmentId) {
    const approval = await this.repository.findById(id);
    if (!approval) {
      throw new NotFoundError('Approval not found');
    }
    await this._enforceAuthorization(approval, requestingUserId, departmentId, 'read');
    return approval;
  }

  async createApproval(data, requestingUserId, departmentId) {
    this._validateCreateApproval(data, departmentId);

    return this.connection.withTransaction(async (client) => {
      // Verify requester exists
      const requester = await this.repository.findUserById(requestingUserId, client);
      if (!requester) {
        throw new NotFoundError('Requester not found');
      }

      // Department validation: PRINCIPAL can create in any department, others must match
      if (departmentId !== 'ALL' && requester.department_id !== departmentId) {
        throw new ForbiddenError('Access denied: You can only create approvals in your department');
      }

      const approval = await this.repository.create(
        {
          type: data.type,
          requestedBy: requestingUserId,
          departmentId: data.departmentId,
          description: data.description,
          status: 'PENDING',
        },
        client
      );

      return approval;
    });
  }

  async getApprovals(requestingUserId, departmentId, options = {}) {
    return this.repository.findAll(requestingUserId, departmentId, options);
  }

  async getPendingApprovals(departmentId, options = {}) {
    return this.repository.findPending(departmentId, options);
  }

  async reviewApproval(id, data, reviewingUserId, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Approval not found');
    }

    // Only allow status change from PENDING to APPROVED/REJECTED/CANCELLED
    if (existing.status !== 'PENDING') {
      throw new BadRequestError('Only pending approvals can be reviewed');
    }

    await this._enforceAuthorization(existing, reviewingUserId, departmentId, 'review');

    // Update approval
    const updated = await this.repository.update(id, {
      status: data.status,
      reviewedBy: data.reviewedBy || reviewingUserId,
      reviewedAt: data.reviewedAt || new Date().toISOString(),
      remarks: data.remarks,
    });

    if (!updated) {
      throw new NotFoundError('Approval not found during update');
    }

    return updated;
  }

  async cancelApproval(id, requestingUserId, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Approval not found');
    }

    // Only allow cancellation of pending approvals by requester
    if (existing.status !== 'PENDING') {
      throw new BadRequestError('Only pending approvals can be cancelled');
    }

    await this._enforceAuthorization(existing, requestingUserId, departmentId, 'cancel');

    const cancelled = await this.repository.update(id, { status: 'CANCELLED' });
    if (!cancelled) {
      throw new NotFoundError('Approval not found during cancellation');
    }

    return cancelled;
  }

  _validateCreateApproval(data, departmentId) {
    const errors = [];
    if (!data.type) {
      errors.push({ field: 'type', message: 'Approval type is required' });
    }
    if (!['LEAVE', 'MARKS_REVISION', 'SYLLABUS_UPDATE', 'COURSE_REGISTRATION', 'OTHER'].includes(data.type)) {
      errors.push({ field: 'type', message: 'Invalid approval type' });
    }
    if (!data.departmentId) {
      errors.push({ field: 'departmentId', message: 'Department ID is required' });
    }
    if (data.description && data.description.length > 1000) {
      errors.push({ field: 'description', message: 'Description cannot exceed 1000 characters' });
    }
    if (data.remarks && data.remarks.length > 1000) {
      errors.push({ field: 'remarks', message: 'Remarks cannot exceed 1000 characters' });
    }

    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', errors);
    }
  }

  async _enforceAuthorization(approval, userId, departmentId, action) {
    const reviewer = await this.repository.findUserById(userId);
    if (reviewer.role === 'PRINCIPAL') {
      return;
    }

    if (action === 'read') {
      if (approval.requested_by === userId) {
        return;
      }
      if (['HOD', 'FACULTY'].includes(reviewer.role) && reviewer.department_id === approval.department_id) {
        return;
      }
    } else if (action === 'review') {
      if (!['HOD', 'FACULTY'].includes(reviewer.role)) {
        throw new ForbiddenError('Only HOD and FACULTY can review approvals');
      }
      if (reviewer.department_id !== approval.department_id) {
        throw new ForbiddenError('Can only review approvals within your department');
      }
      if (approval.status !== 'PENDING') {
        throw new BadRequestError('Only pending approvals can be reviewed');
      }
    } else if (action === 'cancel') {
      if (approval.requested_by === userId) {
        return;
      }
      throw new ForbiddenError('Can only cancel your own approvals');
    }

    throw new ForbiddenError('Access denied');
  }

  _enforceDepartmentScope(user, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (user.department_id !== departmentId) {
      throw new ForbiddenError('Access denied: user is outside your department scope');
    }
  }
}

module.exports = ApprovalService;
