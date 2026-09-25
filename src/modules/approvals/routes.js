const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let approvalController = null;

function getController() {
  if (!approvalController) {
    const ApprovalController = require('./approvalController');
    const ApprovalService = require('./approvalService');
    const ApprovalRepository = require('./approvalRepository');
    const connection = require('../../infrastructure/database/connection');
    const approvalRepository = new ApprovalRepository(connection.getPool());
    const approvalService = new ApprovalService(approvalRepository, connection);
    approvalController = new ApprovalController(approvalService);
  }
  return approvalController;
}

const createApprovalSchema = {
  body: require('./approvalValidator').validateCreateApproval,
};

const updateApprovalSchema = {
  body: require('./approvalValidator').validateUpdateApproval,
};

const listApprovalsSchema = {
  query: require('./approvalValidator').validateListApprovalsQuery,
};

const approvalIdSchema = {
  params: require('./approvalValidator').validateApprovalIdParam,
};

// Create approval - authenticated users can request approval
router.post('/approvals',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(createApprovalSchema),
  asyncHandler(async (req, res) => {
    await getController().createApproval(req, res);
  })
);

// Get all approvals (department-scoped)
router.get('/approvals',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(listApprovalsSchema),
  asyncHandler(async (req, res) => {
    await getController().getMyApprovals(req, res);
  })
);

// Get user's own approvals
router.get('/approvals/me',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  asyncHandler(async (req, res) => {
    await getController().getMyApprovals(req, res);
  })
);

// Get all pending approvals - HOD/FACULTY/PRINCIPAL
router.get('/approvals/pending',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  asyncHandler(async (req, res) => {
    await getController().getPendingApprovals(req, res);
  })
);

// Review/approve/reject approval - HOD/FACULTY/PRINCIPAL
router.put('/approvals/:id/review',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(approvalIdSchema),
  validateRequest(updateApprovalSchema),
  asyncHandler(async (req, res) => {
    await getController().reviewApproval(req, res);
  })
);

// Get specific approval - requester, approver, or PRINCIPAL
router.get('/approvals/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(approvalIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getApproval(req, res);
  })
);

// Cancel pending approval - requester only
router.delete('/approvals/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(approvalIdSchema),
  asyncHandler(async (req, res) => {
    await getController().cancelApproval(req, res);
  })
);

module.exports = router;
