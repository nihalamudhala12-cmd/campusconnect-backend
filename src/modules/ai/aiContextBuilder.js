/**
 * AI Context Builder
 * Builds trusted application context for the AI assistant.
 * Never trusts browser-supplied authorization data.
 * Uses only the authenticated user from the JWT token.
 */

class AIContextBuilder {
  constructor(user, context = {}) {
    this.user = user;
    this.context = context;
  }

  build() {
    const user = this.user;
    if (!user) {
      return null;
    }

    const role = this._normalizeRole(user.role);
    if (!role) {
      return null;
    }
    const departmentId = user.departmentId || null;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role,
        departmentId: departmentId,
      },
      role: role,
      department: departmentId,
      module: this.context.module || 'general',
      permissions: this._getRolePermissions(role),
      allowedData: this._getAllowedData(role, departmentId),
      allowedActions: this._getAllowedActions(role),
    };
  }

  _normalizeRole(role) {
    const validRoles = ['PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'PARENT'];
    const upperRole = role ? role.toUpperCase() : '';
    if (validRoles.includes(upperRole)) return upperRole;
    return null;
  }

  _getRolePermissions(role) {
    const permissions = {
      PRINCIPAL: {
        dashboard: { view: true, manage: true },
        students: { view: true, create: true, edit: true, delete: true, manage: true },
        faculty: { view: true, create: true, edit: true, delete: true },
        classes: { view: true, create: true, edit: true, delete: true, manage: true },
        attendance: { view: true, create: true, edit: true, manage: true },
        results: { view: true, create: true, edit: true, delete: true, approve: true, manage: true },
        timetable: { view: true, create: true, edit: true, delete: true, manage: true },
        analytics: { view: true, manage: true },
        messages: { view: true, create: true, delete: true, manage: true },
        chat: { view: true, viewRooms: true, viewMessages: true, create: true, manage: true },
        announcements: { view: true, create: true, edit: true, delete: true, manage: true, publish_department: true, publish_institution_wide: true },
        approvals: { view: true, approve: true, manage: true },
        department: { view: true, create: true, edit: true, delete: true, manage: true },
        notifications: { view: true, create: true, manage: true },
      },
      HOD: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true, delete: true },
        classes: { view: true, create: true, edit: true, delete: true },
        attendance: { view: true, create: true, edit: true, manage: true },
        results: { view: true, create: true, edit: true, approve: true, manage: true },
        timetable: { view: true, create: true, edit: true },
        analytics: { view: true, manage: true },
        messages: { view: true, create: true },
        chat: { view: true, viewRooms: true, viewMessages: true, create: true },
        announcements: { view: true, create: true, edit: true, delete: true, publish_department: true },
        approvals: { view: true, approve: true },
        department: { view: true, edit: true, manage: true },
        notifications: { view: true, create: true },
      },
      FACULTY: {
        dashboard: { view: true },
        classes: { view: true },
        students: { view: true },
        attendance: { view: true, create: true, edit: true },
        results: { view: true, create: true, edit: true },
        timetable: { view: true },
        analytics: { view: true },
        messages: { view: true, create: true },
        chat: { view: true, viewRooms: true, viewMessages: true, create: true },
        announcements: { view: true },
        approvals: { view: true, create: true },
        notifications: { view: true, create: true },
      },
      STUDENT: {
        dashboard: { view: true },
        classes: { view: true },
        attendance: { view: true },
        results: { view: true },
        timetable: { view: true },
        announcements: { view: true },
        notifications: { view: true },
        messages: { view: true, create: true },
      },
      PARENT: {
        dashboard: { view: true },
        attendance: { view: true },
        results: { view: true },
        timetable: { view: true },
        announcements: { view: true },
        notifications: { view: true, create: true },
      },
    };
    return permissions[role] || { dashboard: { view: true } };
  }

  _getAllowedData(role, departmentId) {
    const permissions = this._getRolePermissions(role);
    const allowed = [];
    for (const [resource, actions] of Object.entries(permissions)) {
      if (actions && actions.view) {
        allowed.push(resource);
      }
    }
    return allowed;
  }

  _getAllowedActions(role) {
    const permissions = this._getRolePermissions(role);
    const actions = new Set();
    for (const [resource, actionMap] of Object.entries(permissions)) {
      if (actionMap) {
        for (const [action, value] of Object.entries(actionMap)) {
          if (value === true) {
            actions.add(action);
          }
        }
      }
    }
    return Array.from(actions);
  }
}

module.exports = AIContextBuilder;