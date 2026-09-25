/**
 * Controller Registry
 * Step 6.1 — Backend Foundation
 *
 * Centralized export point for all controllers.
 * Import individual controllers from their respective files.
 *
 * Example usage (future steps):
 *   const { UserController } = require('./controllers');
 *   const userController = new UserController(userService);
 *
 * Pattern:
 *   controllers/
 *     index.js        ← Registry (this file)
 *     baseController.js ← Base class all controllers extend
 *     userController.js ← Specific controller (future)
 */

const BaseController = require('./baseController');

module.exports = {
  BaseController,
  // Future controllers will be added here:
  // UserController: require('./userController'),
  // CourseController: require('./courseController'),
};