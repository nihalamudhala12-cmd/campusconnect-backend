/**
 * Departments Module
 * M2 — Departments
 */
const DepartmentRepository = require('./departmentRepository');
const DepartmentService = require('./departmentService');
const DepartmentController = require('./departmentController');
const deptRoutes = require('./routes');

function createDepartmentsModule(connection) {
  const repo = new DepartmentRepository(connection.getPool());
  const service = new DepartmentService(repo, connection);
  const controller = new DepartmentController(service);
  return { router: deptRoutes, repository: repo, service, controller };
}

module.exports = {
  createDepartmentsModule,
  deptRoutes,
  DepartmentRepository,
  DepartmentService,
  DepartmentController,
};
