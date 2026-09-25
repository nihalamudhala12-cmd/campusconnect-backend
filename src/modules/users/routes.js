const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let userController = null;

function getController() {
  if (!userController) {
    const UserController = require('./userController');
    const UserService = require('./userService');
    const UserRepository = require('./userRepository');
    const connection = require('../../infrastructure/database/connection');
    const userRepository = new UserRepository(connection.getPool());
    const userService = new UserService(userRepository, connection);
    userController = new UserController(userService);
  }
  return userController;
}

const createUserSchema = {
  body: require('./userValidator').validateCreateUser,
};

const updateUserSchema = {
  body: require('./userValidator').validateUpdateUser,
};

const listUsersSchema = {
  query: require('./userValidator').validateListUsersQuery,
};

const userIdSchema = {
  params: require('./userValidator').validateUserIdParam,
};

router.get('/users',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(listUsersSchema),
  asyncHandler(async (req, res) => {
    await getController().getUsers(req, res);
  })
);

router.get('/users/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(userIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getUser(req, res);
  })
);

router.post('/users',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(createUserSchema),
  asyncHandler(async (req, res) => {
    await getController().createUser(req, res);
  })
);

router.put('/users/:id',
  authenticate,
  validateRequest(userIdSchema),
  validateRequest(updateUserSchema),
  asyncHandler(async (req, res) => {
    const isSelfUpdate = req.params.id === req.user.id;
    if (!isSelfUpdate && req.user.role !== 'HOD' && req.user.role !== 'PRINCIPAL') {
      const { ForbiddenError } = require('../../errors');
      throw new ForbiddenError('Cannot update another user');
    }
    if (req.user && req.user.role === 'PRINCIPAL') {
      req.departmentId = 'ALL';
    } else if (!req.departmentId && req.user && req.user.departmentId) {
      req.departmentId = req.user.departmentId;
    }
    await getController().updateUser(req, res);
  })
);

router.post('/users/me/complete-profile',
  authenticate,
  asyncHandler(async (req, res) => {
    // Self-update endpoint - bypass department scope restrictions
    req.departmentId = req.user.departmentId || 'ALL';
    await getController().completeProfile(req, res);
  })
);

router.delete('/users/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(userIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deactivateUser(req, res);
  })
);

module.exports = router;
