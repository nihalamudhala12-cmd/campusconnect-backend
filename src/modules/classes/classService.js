/**
 * Class Service
 * M5 — Classes
 */

const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');

class ClassService extends BaseService {
  constructor(repository, connection) {
    super(repository);
    this.connection = connection;
  }

  async getClass(id, departmentId) {
    const cls = await this.repository.findById(id);
    if (!cls) {
      throw new NotFoundError('Class not found');
    }
    this._enforceDepartmentScope(cls, departmentId);
    return cls;
  }

  async getClasses(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async getClassesByDepartment(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async createClass(data, departmentId) {
    const errors = [];
    if (!data || !data.name) errors.push({ field: 'name', message: 'Name is required' });
    if (!data || !data.code) errors.push({ field: 'code', message: 'Code is required' });
    if (!data || !data.departmentId) errors.push({ field: 'departmentId', message: 'Department ID is required' });
    if (errors.length > 0) throw new BadRequestError('Validation failed', errors);

    // Check for duplicate code within department
    const exists = await this.repository.codeExists(data.code, data.departmentId);
    if (exists) {
      throw new ConflictError('Department code already exists in this department');
    }

    return this.connection.withTransaction(async (client) => {
      const cls = await this.repository.create(
        {
          name: data.name.trim(),
          code: data.code.toUpperCase(),
          departmentId: data.departmentId,
          semester: data.semester,
          section: data.section || null,
          status: data.status ? data.status.toUpperCase() : 'ACTIVE',
        },
        client
      );
      return cls;
    });
  }

  async updateClass(id, data, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Class not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    // Check for duplicate code within department (excluding this class)
    if (data.code !== undefined) {
      const exists = await this.repository.codeExists(data.code, departmentId, existing.id);
      if (exists) {
        throw new ConflictError('Department code already exists in this department');
      }
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(
        id,
        {
          name: data.name,
          code: data.code,
          departmentId: data.departmentId || existing.department_id,
          semester: data.semester,
          section: data.section,
          status: data.status,
        },
        client
      );

      if (!updated) {
        throw new NotFoundError('Class not found during update');
      }

      return updated;
    });
  }

  async deactivateClass(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Class not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    if (existing.status === 'INACTIVE') {
      throw new BadRequestError('Class is already inactive');
    }

    return this.connection.withTransaction(async (client) => {
      const deactivated = await this.repository.deactivate(id, client);
      if (!deactivated) {
        throw new NotFoundError('Class not found during deactivation');
      }
      return deactivated;
    });
  }

  _enforceDepartmentScope(cls, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (cls.department_id !== departmentId) {
      throw new ForbiddenError('Access denied: class is outside your department scope');
    }
  }
}

module.exports = ClassService;