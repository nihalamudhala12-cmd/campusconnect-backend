/**
 * Classes Routes
 * M5 — Classes
 */

const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const {
  validateCreateClass,
  validateUpdateClass,
  validateListClassesQuery,
  validateClassIdParam,
} = require('./classValidator');

const router = Router();

let classController = null;
function getController() {
  if (!classController) {
    const ClassController = require('./classController');
    const ClassService = require('./classService');
    const ClassRepository = require('./classRepository');
    const connection = require('../../infrastructure/database/connection');
    const repo = new ClassRepository(connection.getPool());
    const service = new ClassService(repo, connection);
    classController = new ClassController(service);
  }
  return classController;
}

router.get('/classes',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest({ query: validateListClassesQuery }),
  asyncHandler(async (req, res) => {
    await getController().getClasses(req, res);
  })
);

router.get('/classes/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest({ params: validateClassIdParam }),
  asyncHandler(async (req, res) => {
    await getController().getClass(req, res);
  })
);

router.post('/classes',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest({ body: validateCreateClass }),
  asyncHandler(async (req, res) => {
    await getController().createClass(req, res);
  })
);

router.put('/classes/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest({ params: validateClassIdParam }),
  validateRequest({ body: validateUpdateClass }),
  asyncHandler(async (req, res) => {
    await getController().updateClass(req, res);
  })
);

router.delete('/classes/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest({ params: validateClassIdParam }),
  asyncHandler(async (req, res) => {
    await getController().deactivateClass(req, res);
  })
);

module.exports = router;
