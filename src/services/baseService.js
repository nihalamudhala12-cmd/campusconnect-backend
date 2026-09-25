/**
 * Base Service
 * Step 6.1 — Backend Foundation
 *
 * Provides a thin foundation class for all service classes.
 * Services contain business logic and orchestrate repository calls.
 *
 * Layer Dependency:
 *   Services → Repositories (downward)
 *   Services MUST NOT depend on HTTP/Express concerns (Controllers only).
 *
 * Usage (future step):
 *   class UserService extends BaseService {
 *     constructor(userRepository) {
 *       super(userRepository);
 *     }
 *     async getUser(id) { ... }
 *   }
 */

class BaseService {
  constructor(repository) {
    if (this.constructor === BaseService) {
      throw new Error('BaseService is abstract and cannot be instantiated directly.');
    }
    this.repository = repository;
  }
}

module.exports = BaseService;
