/**
 * Student Routes
 * M3 — Students
 */

const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const {
  validateCreateStudent,
  validateUpdateStudent,
  validateListStudentsQuery,
  validateStudentIdParam,
} = require('./studentValidator');

const router = Router();

let studentController = null;
function getController() {
  if (!studentController) {
    const StudentController = require('./studentController');
    const StudentService = require('./studentService');
    const StudentRepository = require('./studentRepository');
    const connection = require('../../infrastructure/database/connection');
    const repo = new StudentRepository(connection.getPool());
    const service = new StudentService(repo, connection);
    studentController = new StudentController(service);
  }
  return studentController;
}

const createStudentSchema = {
  body: validateCreateStudent,
};

const updateStudentSchema = {
  body: validateUpdateStudent,
};

const listStudentsSchema = {
  query: validateListStudentsQuery,
};

const studentIdSchema = {
  params: validateStudentIdParam,
};

router.get('/students',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(listStudentsSchema),
  asyncHandler(async (req, res) => {
    await getController().getStudents(req, res);
  })
);

router.get('/students/me',
  authenticate,
  authorize(['STUDENT']),
  asyncHandler(async (req, res) => {
    await getController().getMyStudent(req, res);
  })
);

router.get('/students/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(studentIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getStudent(req, res);
  })
);

router.post('/students',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(createStudentSchema),
  asyncHandler(async (req, res) => {
    await getController().createStudent(req, res);
  })
);

router.put('/students/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(studentIdSchema),
  validateRequest(updateStudentSchema),
  asyncHandler(async (req, res) => {
    await getController().updateStudent(req, res);
  })
);

router.delete('/students/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(studentIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deactivateStudent(req, res);
  })
);

module.exports = router;
