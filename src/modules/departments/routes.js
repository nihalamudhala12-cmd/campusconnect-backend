/**
 * Department Routes
 * M2 — Departments
 */
const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const {
  validateCreateDepartment,
  validateUpdateDepartment,
  validateListDepartmentsQuery,
  validateDepartmentIdParam,
} = require('./departmentValidator');

const router = Router();

let deptController = null;
function getController() {
  if (!deptController) {
    const DepartmentController = require('./departmentController');
    const DepartmentService = require('./departmentService');
    const DepartmentRepository = require('./departmentRepository');
    const connection = require('../../infrastructure/database/connection');
    const repo = new DepartmentRepository(connection.getPool());
    const service = new DepartmentService(repo, connection);
    deptController = new DepartmentController(service);
  }
  return deptController;
}

router.get('/departments',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest({ query: validateListDepartmentsQuery }),
  asyncHandler(async (req, res) => {
    await getController().getDepartments(req, res);
  })
);

router.get('/departments/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest({ params: validateDepartmentIdParam }),
  asyncHandler(async (req, res) => {
    await getController().getDepartment(req, res);
  })
);

router.post('/departments',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest({ body: validateCreateDepartment }),
  asyncHandler(async (req, res) => {
    await getController().createDepartment(req, res);
  })
);

router.put('/departments/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest({ params: validateDepartmentIdParam }),
  validateRequest({ body: validateUpdateDepartment }),
  asyncHandler(async (req, res) => {
    await getController().updateDepartment(req, res);
  })
);

router.delete('/departments/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest({ params: validateDepartmentIdParam }),
  asyncHandler(async (req, res) => {
    await getController().deactivateDepartment(req, res);
  })
);

module.exports = router;
