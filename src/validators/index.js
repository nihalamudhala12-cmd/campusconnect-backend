/**
 * Validators Registry
 * Step 6.1 — Backend Foundation
 *
 * Centralized export point for all request validators and validation middleware.
 * Validators ensure incoming request data meets expected formats
 * before it reaches the service layer.
 */

const validateRequest = require('../middleware/validateRequest');

module.exports = {
  validateRequest,
  // Future concrete validators will be registered here:
  // userValidators: require('./userValidators'),
  // courseValidators: require('./courseValidators'),
};