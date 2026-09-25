/**
 * Async Handler Wrapper
 * Step 6.1 — Backend Foundation
 *
 * Wraps async route handlers to forward errors to Express's error middleware.
 * Avoids the need for try/catch in every async route handler.
 *
 * Usage (future step):
 *   router.get('/users', asyncHandler(async (req, res) => {
 *     const users = await userService.findAll();
 *     res.json(users);
 *   }));
 *
 * @param {Function} fn Async route handler to wrap
 * @returns {Function} Wrapped function for Express
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
