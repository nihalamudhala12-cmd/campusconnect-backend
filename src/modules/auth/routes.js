const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let authController = null;

function getController() {
  if (!authController) {
    const AuthController = require('./authController');
    const AuthService = require('./authService');
    const AuthRepository = require('./authRepository');
    const connection = require('../../infrastructure/database/connection');
    const authRepository = new AuthRepository(connection.getPool());
    const authService = new AuthService(authRepository, connection);
    authController = new AuthController(authService);
  }
  return authController;
}

router.post('/login',
  validateRequest({ body: require('./authValidator').validateLogin }),
  asyncHandler(async (req, res) => {
    await getController().login(req, res);
  })
);

router.post('/mfa-verify',
  validateRequest({ body: require('./authValidator').validateMfaVerify }),
  asyncHandler(async (req, res) => {
    await getController().mfaVerify(req, res);
  })
);

router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    await getController().me(req, res);
  })
);

module.exports = router;

