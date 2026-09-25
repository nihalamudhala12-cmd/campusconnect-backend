/**
 * Classes Module
 * M5 — Classes
 *
 * Registers the Classes feature module with the module system.
 */

const ClassRepository = require('./classRepository');
const ClassService = require('./classService');
const ClassController = require('./classController');
const classRoutes = require('./routes');

function createClassesModule(connection) {
  const classRepository = new ClassRepository(connection.getPool());
  const classService = new ClassService(classRepository, connection);
  const classController = new ClassController(classService);

  return {
    router: classRoutes,
    repository: classRepository,
    service: classService,
    controller: classController,
  };
}

module.exports = {
  createClassesModule,
  classRoutes,
  ClassRepository,
  ClassService,
  ClassController,
};