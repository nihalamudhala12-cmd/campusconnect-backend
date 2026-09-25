/**
 * Faculty Routes
 * M4 — Faculty
 */

const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const {
  validateCreateFaculty,
  validateUpdateFaculty,
  validateListFacultyQuery,
  validateFacultyIdParam,
} = require('./facultyValidator');

const router = Router();

let facultyController = null;
function getController() {
  if (!facultyController) {
    const FacultyController = require('./facultyController');
    const FacultyService = require('./facultyService');
    const FacultyRepository = require('./facultyRepository');
    const connection = require('../../infrastructure/database/connection');
    const repo = new FacultyRepository(connection.getPool());
    const service = new FacultyService(repo, connection);
    facultyController = new FacultyController(service);
  }
  return facultyController;
}

const createFacultySchema = {
  body: validateCreateFaculty,
};

const updateFacultySchema = {
  body: validateUpdateFaculty,
};

const listFacultySchema = {
  query: validateListFacultyQuery,
};

const facultyIdSchema = {
  params: validateFacultyIdParam,
};

router.get('/faculties',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(listFacultySchema),
  asyncHandler(async (req, res) => {
    await getController().getFaculties(req, res);
  })
);

router.get('/faculties/me',
  authenticate,
  authorize(['FACULTY', 'HOD']),
  asyncHandler(async (req, res) => {
    await getController().getMyFaculty(req, res);
  })
);

router.get('/faculties/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(facultyIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getFaculty(req, res);
  })
);

router.post('/faculties',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(createFacultySchema),
  asyncHandler(async (req, res) => {
    await getController().createFaculty(req, res);
  })
);

router.put('/faculties/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(facultyIdSchema),
  validateRequest(updateFacultySchema),
  asyncHandler(async (req, res) => {
    await getController().updateFaculty(req, res);
  })
);

router.delete('/faculties/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(facultyIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deactivateFaculty(req, res);
  })
);

module.exports = router;
