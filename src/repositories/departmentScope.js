     /**
 * Department Multi-Tenant Data Isolation Helper
 * Step 6.6 — Database Integration Hardening (DB-AUD-07)
 *
 * Provides explicit and derived department-scope query filtering for repository layers.
* Enforces institution-wide access for PRINCIPAL ('ALL') and strict department scoping
* for HOD, FACULTY, STUDENT, and PARENT roles.
 *
 * Layer Dependency:
 *   departmentScope → errors/ForbiddenError
 */

const { ForbiddenError } = require('../errors');

// Direct department ownership tables (contain department_id column)
const DIRECT_DEPT_TABLES = new Set([
  'departments',
  'users',
  'classes',
  'courses',
  'announcements',
  'approvals',
  'chat_rooms',
]);

/**
 * Apply department scope filtering to SQL queries based on table type and authenticated context.
 *
 * @param {string} tableName Database table name
 * @param {string} departmentId Authenticated department scope ('ALL', UUID, or code)
 * @param {Array} params SQL query parameter array (mutated to push parameter)
 * @param {string} [alias=''] Optional table alias prefix (e.g. 'c.')
 * @returns {{ clause: string, join: string }} SQL filter clause and optional JOIN
 */
function applyDepartmentScope(tableName, departmentId, params = [], alias = '') {
  const prefix = alias ? (alias.endsWith('.') ? alias : `${alias}.`) : '';

  // 1. Institution-Wide Scope (PRINCIPAL)
  if (departmentId === 'ALL') {
    switch (tableName) {
      case 'faculty_profiles':
      case 'student_profiles':
      case 'notifications':
        return { clause: '1=1', join: `JOIN users users_dept ON ${prefix}user_id = users_dept.id` };
      case 'timetable_entries':
      case 'attendance':
        return { clause: '1=1', join: `JOIN classes classes_dept ON ${prefix}class_id = classes_dept.id` };
      case 'results':
        return { clause: '1=1', join: `JOIN courses courses_dept ON ${prefix}course_id = courses_dept.id` };
      default:
        return { clause: '1=1', join: '' };
    }
  }

  // 2. Fail-Closed Check: Non-PRINCIPAL must have a valid departmentId
  if (!departmentId) {
    throw new ForbiddenError('Department context is required for department-scoped queries');
  }

  // 3. Direct Department Ownership Tables
  if (DIRECT_DEPT_TABLES.has(tableName)) {
    if (tableName === 'departments') {
      params.push(departmentId);
      const paramIndex = params.length;
      return {
        clause: `${prefix}id = $${paramIndex}`,
        join: '',
      };
    }
    params.push(departmentId);
    const paramIndex = params.length;
    return {
      clause: `${prefix}department_id = $${paramIndex}`,
      join: '',
    };
  }

  // 4. Derived Department Ownership Tables (resolved via relationships)
  params.push(departmentId);
  const paramIndex = params.length;

  switch (tableName) {
    case 'faculty_profiles':
    case 'student_profiles':
      return {
        clause: `users_dept.department_id = $${paramIndex}`,
        join: `JOIN users users_dept ON ${prefix}user_id = users_dept.id`,
      };

    case 'timetable_entries':
    case 'attendance':
      return {
        clause: `classes_dept.department_id = $${paramIndex}`,
        join: `JOIN classes classes_dept ON ${prefix}class_id = classes_dept.id`,
      };

    case 'results':
      return {
        clause: `courses_dept.department_id = $${paramIndex}`,
        join: `JOIN courses courses_dept ON ${prefix}course_id = courses_dept.id`,
      };

    case 'notifications':
      // User-bound entity (department derived via user_id)
      return {
        clause: `users_dept.department_id = $${paramIndex}`,
        join: `JOIN users users_dept ON ${prefix}user_id = users_dept.id`,
      };

    default:
      // Fallback fail-closed
      return {
        clause: `${prefix}department_id = $${paramIndex}`,
        join: '',
      };
  }
}

module.exports = {
  applyDepartmentScope,
};
