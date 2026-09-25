/**
 * Role-Based Access Control (RBAC) & Scope Middleware
 * Step 6.1 — Backend Foundation
 *
 * Enforces role authorization and establishes department scope context (req.departmentId).
 * Always FAIL-CLOSED: Unauthenticated requests or unauthorized roles return 401 / 403.
 *
 * Layer Dependency:
 *   rbacMiddleware → errors/* (UnauthorizedError, ForbiddenError)
 */

const { UnauthorizedError, ForbiddenError } = require('../errors');
const { applyDepartmentScope } = require('../repositories/departmentScope');

function authorize(allowedRoles = []) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, _res, next) => {
    // 1. Fail-closed: Must be authenticated
    if (!req.user || !req.user.role) {
      return next(new UnauthorizedError('Authentication required for authorized resources'));
    }

    const { role, departmentId } = req.user;

    // 2. PRINCIPAL role bypass: Principal has institution-wide scope
    if (role === 'PRINCIPAL') {
      req.departmentId = 'ALL';
      return next();
    }

    // 3. Role authorization check (FAIL-CLOSED)
    if (rolesArray.length > 0 && !rolesArray.includes(role)) {
      return next(new ForbiddenError(`Role '${role}' is not authorized to perform this action`));
    }

    // 4. Fail-closed: Non-PRINCIPAL must have a valid departmentId
    if (!departmentId) {
      return next(new ForbiddenError('Department context is required for authenticated users'));
    }

    // 5. Attach department scope context for downstream queries
    req.departmentId = departmentId;
    next();
  };
}

function requireDepartmentScope(tableName) {
  return (req, _res, next) => {
    try {
      const deptId = req.departmentId || (req.user && req.user.departmentId) || null;
      const params = [];
      const { clause, join } = applyDepartmentScope(tableName, deptId, params);
      req.departmentScope = { clause, join, params };
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  authorize,
  requireDepartmentScope,
  applyDepartmentScope,
};
