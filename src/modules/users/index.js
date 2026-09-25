/**
 * Users Module
 * Step 6.7 — API Module 1: Users
 *
 * Registers the Users feature module with the module system.
 */

const UserRepository = require('./userRepository');
const UserService = require('./userService');
const UserController = require('./userController');
const userRoutes = require('./routes');

function createUsersModule(connection) {
  const userRepository = new UserRepository(connection.getPool());
  const userService = new UserService(userRepository, connection);
  const userController = new UserController(userService);

  return {
    router: userRoutes,
    repository: userRepository,
    service: userService,
    controller: userController,
  };
}

module.exports = {
  createUsersModule,
  userRoutes,
  UserRepository,
  UserService,
  UserController,
};
