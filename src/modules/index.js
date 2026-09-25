/**
 * Feature Modules Registry
 * Step 6.1 — Backend Foundation
 *
 * Provides a pattern for organizing backend code by feature domain
 * rather than by technical layer. Each module contains its own
 * routes, controllers, services, and repositories.
 *
 * This pattern helps scale the application as features are added.
 *
 * Pattern:
 *   modules/
 *     index.js          ← Registry (this file)
 *     auth/             ← Authentication feature module (future)
 *     users/            ← User management feature module (future)
 *     courses/          ← Course management feature module (future)
 *
 * Example module structure (future):
 *   modules/
 *     users/
 *       routes.js
 *       userController.js
 *       userService.js
 *       userRepository.js
 *       userValidator.js
 *
 * Layer Dependency per module:
 *   Routes → Controllers → Services → Repositories → Future Data Source
 */

const modules = {};

/**
 * Registers a feature module.
 *
 * @param {string} name - Module name (e.g., 'users', 'courses')
 * @param {object} handlers - Object containing route handlers
 *
 * Usage (future step):
 *   registerModule('users', {
 *     router: userRouter,
 *     controller: userController,
 *     service: userService,
 *     repository: userRepository,
 *   });
 */
function registerModule(name, handlers) {
  if (modules[name]) {
    throw new Error(`Module "${name}" is already registered`);
  }
  modules[name] = handlers;
}

/**
 * Returns all registered modules.
 */
function getModules() {
  return { ...modules };
}

module.exports = {
  registerModule,
  getModules,
  // Future feature modules will be registered here:
  // registerModule('auth', require('./auth')),
  // registerModule('users', require('./users')),
  // registerModule('courses', require('./courses')),
};
