/**
 * User Service
 * Step 6.7 — API Module 1: Users
 *
 * Contains business logic for user management.
 * Enforces department scoping, validates input, and orchestrates repository calls.
 * Transaction scope is owned by the service layer.
 */

const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');

const VALID_ROLES = ['PRINCIPAL', 'HOD', 'FACULTY', 'STUDENT', 'PARENT'];

const ROLE_HIERARCHY = {
  PRINCIPAL: 5,
  HOD: 4,
  FACULTY: 3,
  STUDENT: 1,
  PARENT: 1,
};

class UserService extends BaseService {
  constructor(userRepository, connection) {
    super(userRepository);
    this.connection = connection;
  }

  async getUser(id, departmentId) {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    this._enforceDepartmentScope(user, departmentId);
    return user;
  }

  async getUsers(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async createUser(data, departmentId) {
    const errors = [];
    if (!data.name) errors.push({ field: 'name', message: 'Name is required' });
    if (!data.email) errors.push({ field: 'email', message: 'Email is required' });
    if (!data.role) errors.push({ field: 'role', message: 'Role is required' });
    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', errors);
    }

    const targetDeptId = data.departmentId || departmentId;

    if (departmentId !== 'ALL' && targetDeptId !== departmentId) {
      throw new ForbiddenError('Cannot create user in a different department');
    }

    const roleToAssign = data.role.toUpperCase();
    this._enforceRoleAssignment(roleToAssign, departmentId);

    return this.connection.withTransaction(async (client) => {
      const existing = await this.repository.findByIdentifier(data.email, client);
      if (existing) {
        throw new ConflictError('A user with this email already exists');
      }

      const user = await this.repository.create(
        {
          name: data.name,
          email: data.email,
          role: roleToAssign,
          departmentId: targetDeptId,
          status: data.status ? data.status.toUpperCase() : 'ACTIVE',
        },
        client
      );

      return user;
    });
  }

  async updateUser(id, data, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailTaken = await this.repository.emailExists(data.email, id);
      if (emailTaken) {
        throw new ConflictError('A user with this email already exists');
      }
    }

    const targetDeptId = data.departmentId !== undefined ? data.departmentId : existing.department_id;

    if (departmentId !== 'ALL' && targetDeptId !== departmentId) {
      throw new ForbiddenError('Cannot move user to a different department');
    }

    if (data.role !== undefined) {
      const targetRole = data.role.toUpperCase();
      this._enforceRoleUpdate(targetRole, existing, departmentId);
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(
        id,
        {
          name: data.name,
          email: data.email,
          role: data.role,
          departmentId: targetDeptId,
          status: data.status,
          profileCompleted: data.profileCompleted,
        },
        client
      );

      if (!updated) {
        throw new NotFoundError('User not found during update');
      }

      return updated;
    });
  }

  async deactivateUser(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    if (existing.status === 'INACTIVE') {
      throw new BadRequestError('User is already deactivated');
    }

    this._enforceDeactivation(existing, departmentId);

    return this.connection.withTransaction(async (client) => {
      const deactivated = await this.repository.deactivate(id, client);
      if (!deactivated) {
        throw new NotFoundError('User not found during deactivation');
      }
      return deactivated;
    });
  }

  async completeProfile(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    // Allow self-update without department scope enforcement
    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(
        id,
        { profileCompleted: true },
        client
      );

      if (!updated) {
        throw new NotFoundError('User not found during profile completion');
      }

      return updated;
    });
  }

  _enforceDepartmentScope(user, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (user.department_id !== departmentId) {
      throw new ForbiddenError('Access denied: user is outside your department scope');
    }
  }

  _enforceRoleAssignment(role, departmentId) {
    if (departmentId !== 'ALL' && role === 'PRINCIPAL') {
      throw new ForbiddenError('Only PRINCIPAL can create users with PRINCIPAL role');
    }
  }

  _enforceRoleUpdate(targetRole, existingUser, requesterDepartmentId) {
    const targetRoleLevel = ROLE_HIERARCHY[targetRole];
    if (targetRoleLevel === undefined) {
      throw new BadRequestError(`Invalid role: ${targetRole}`);
    }

    if (requesterDepartmentId !== 'ALL' && targetRole === 'PRINCIPAL') {
      throw new ForbiddenError('Cannot assign PRINCIPAL role to a user');
    }
  }

  _enforceDeactivation(user, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }

    if (user.role === 'PRINCIPAL') {
      throw new ForbiddenError('Cannot deactivate a PRINCIPAL');
    }

    if (user.role === 'HOD' && departmentId !== 'ALL') {
      throw new ForbiddenError('Cannot deactivate an HOD');
    }
  }
}

module.exports = UserService;
