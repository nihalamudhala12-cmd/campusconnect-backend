/**
 * Students Module
 * M3 — Students
 *
 * Registers the Students feature module with the module system.
 */

const StudentRepository = require('./studentRepository');
const StudentService = require('./studentService');
const StudentController = require('./studentController');
const studentRoutes = require('./routes');

function createStudentsModule(connection) {
  const studentRepository = new StudentRepository(connection.getPool());
  const studentService = new StudentService(studentRepository, connection);
  const studentController = new StudentController(studentService);

  return {
    router: studentRoutes,
    repository: studentRepository,
    service: studentService,
    controller: studentController,
  };
}

module.exports = {
  createStudentsModule,
  studentRoutes,
  StudentRepository,
  StudentService,
  StudentController,
};