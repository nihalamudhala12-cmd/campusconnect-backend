/**
 * Base Controller
 * Step 6.1 — Backend Foundation
 *
 * Provides a thin foundation class for all controllers.
 * Controllers are responsible for translating HTTP requests into
 * service calls and formatting the HTTP response.
 *
 * Layer Dependency:
 *   Controllers → Services (downward)
 *   Controllers → Validators + AsyncHandlers (helpers)
 *   Controllers MUST NOT directly access repositories or the data source.
 *
 * Usage (future step):
 *   class UserController extends BaseController {
 *     async getUser(req, res) {
 *       const user = await this.userService.findById(req.params.id);
 *       return this.ok(res, user);
 *     }
 *   }
 */

class BaseController {
  constructor(service) {
    if (this.constructor === BaseController) {
      throw new Error('BaseController is abstract and cannot be instantiated directly.');
    }
    this.service = service;
  }

  /**
   * Standard 200 OK response.
   * @param {Response} res
   * @param {any} data
   * @param {string} [message]
   */
  ok(res, data, message = 'Success') {
    return res.json({ success: true, message, data });
  }

  /**
   * Standard 201 Created response.
   * @param {Response} res
   * @param {any} data
   * @param {string} [message]
   */
  created(res, data, message = 'Created') {
    return res.status(201).json({ success: true, message, data });
  }

  /**
   * Standard 400 Bad Request response.
   * @param {Response} res
   * @param {string} message
   * @param {any} [details]
   */
  badRequest(res, message = 'Bad Request', details = null) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message,
        ...(details !== null && details !== undefined && { details }),
      },
    });
  }

  /**
   * Standard 401 Unauthorized response.
   * @param {Response} res
   * @param {string} message
   * @param {any} [details]
   */
  unauthorized(res, message = 'Unauthorized', details = null) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
        ...(details !== null && details !== undefined && { details }),
      },
    });
  }

  /**
   * Standard 403 Forbidden response.
   * @param {Response} res
   * @param {string} message
   * @param {any} [details]
   */
  forbidden(res, message = 'Forbidden', details = null) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
        ...(details !== null && details !== undefined && { details }),
      },
    });
  }

  /**
   * Standard 404 Not Found response.
   * @param {Response} res
   * @param {string} message
   * @param {any} [details]
   */
  notFound(res, message = 'Not Found', details = null) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message,
        ...(details !== null && details !== undefined && { details }),
      },
    });
  }
}

module.exports = BaseController;
