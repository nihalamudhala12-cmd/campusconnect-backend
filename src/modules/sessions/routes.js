const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let sessionController = null;

function getController() {
  if (!sessionController) {
    const SessionController = require('./sessionController');
    const SessionService = require('./sessionService');
    const SessionRepository = require('./sessionRepository');
    const connection = require('../../infrastructure/database/connection');
    const sessionRepository = new SessionRepository(connection.getPool());
    const sessionService = new SessionService(sessionRepository, connection);
    sessionController = new SessionController(sessionService);
  }
  return sessionController;
}

const createSessionSchema = {
  body: (body) => {
    const errors = [];
    if (!body || typeof body.token !== 'string' || body.token.trim().length === 0) {
      errors.push({ field: 'token', message: 'Session token is required' });
    }
    if (!body || typeof body.userId !== 'string' || body.userId.trim().length === 0) {
      errors.push({ field: 'userId', message: 'User ID is required' });
    }
    if (!body || typeof body.deviceFingerprint !== 'string' || body.deviceFingerprint.trim().length === 0) {
      errors.push({ field: 'deviceFingerprint', message: 'Device fingerprint is required' });
    }
    if (!body || typeof body.ipAddress !== 'string' || body.ipAddress.trim().length === 0) {
      errors.push({ field: 'ipAddress', message: 'IP address is required' });
    }
    if (!body || typeof body.userAgent !== 'string' || body.userAgent.trim().length === 0) {
      errors.push({ field: 'userAgent', message: 'User agent is required' });
    }
    return errors;
  }
};

const updateSessionSchema = {
  body: (body) => {
    const errors = [];
    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      errors.push({ field: 'isActive', message: 'isActive must be a boolean value' });
    }
    if (body.expiresAt !== undefined) {
      const date = new Date(body.expiresAt);
      if (isNaN(date.getTime())) {
        errors.push({ field: 'expiresAt', message: 'Expires at must be a valid ISO 8601 timestamp' });
      }
    }
    return errors;
  }
};

const listSessionsSchema = {
  query: (query) => {
    const errors = [];
    if (query.page !== undefined) {
      const page = parseInt(query.page, 10);
      if (Number.isNaN(page) || page < 1) {
        errors.push({ field: 'page', message: 'Page must be a positive integer' });
      }
    }
    if (query.limit !== undefined) {
      const limit = parseInt(query.limit, 10);
      if (Number.isNaN(limit) || limit < 1 || limit > 100) {
        errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
      }
    }
    return errors;
  }
};

const sessionIdSchema = {
  params: (params) => {
    const errors = [];
    if (!params.id) {
      errors.push({ field: 'id', message: 'Session ID is required' });
      return errors;
    }
    const { validateUUID } = require('../../utils/idMapper');
    if (!validateUUID(params.id)) {
      errors.push({ field: 'id', message: 'Session ID must be a valid UUID' });
    }
    return errors;
  }
};

// GET /sessions - List sessions for current user (admin only)
router.get('/sessions',
  authenticate,
  authorize(['PRINCIPAL', 'HOD']),
  validateRequest(listSessionsSchema),
  asyncHandler(async (req, res) => {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    };
    await getController().getSessions(req, res, options);
  })
);

// GET /sessions/devices - List user devices (must be before /sessions/:id)
router.get('/sessions/devices',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  asyncHandler(async (req, res) => {
    await getController().getUserDevices(req, res);
  })
);

// GET /sessions/:id - Get specific session
router.get('/sessions/:id',
  authenticate,
  authorize(['PRINCIPAL', 'HOD']),
  validateRequest(sessionIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getSession(req, res);
  })
);

// POST /sessions - Create new session
router.post('/sessions',
  authenticate,
  validateRequest(createSessionSchema),
  asyncHandler(async (req, res) => {
    await getController().createSession(req, res);
  })
);

// PUT /sessions/:id - Update session
router.put('/sessions/:id',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(sessionIdSchema),
  validateRequest(updateSessionSchema),
  asyncHandler(async (req, res) => {
    await getController().updateSession(req, res);
  })
);

// DELETE /sessions/:id - Revoke/deactivate session
router.delete('/sessions/:id',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(sessionIdSchema),
  asyncHandler(async (req, res) => {
    await getController().revokeSession(req, res);
  })
);

module.exports = router;
