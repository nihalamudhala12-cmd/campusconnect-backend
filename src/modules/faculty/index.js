/**
 * Faculty Module
 * M4 — Faculty
 *
 * Registers the Faculty feature module with the module system.
 */

const FacultyRepository = require('./facultyRepository');
const FacultyService = require('./facultyService');
const FacultyController = require('./facultyController');
const facultyRoutes = require('./routes');

function createFacultyModule(connection) {
  const facultyRepository = new FacultyRepository(connection.getPool());
  const facultyService = new FacultyService(facultyRepository, connection);
  const facultyController = new FacultyController(facultyService);

  return {
    router: facultyRoutes,
    repository: facultyRepository,
    service: facultyService,
    controller: facultyController,
  };
}

module.exports = {
  createFacultyModule,
  facultyRoutes,
  FacultyRepository,
  FacultyService,
  FacultyController,
};