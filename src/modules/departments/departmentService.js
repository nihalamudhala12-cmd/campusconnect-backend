/**
 * Department Service
 * M2 — Departments
 */
const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');

class DepartmentService extends BaseService {
  constructor(repository, connection) {
    super(repository);
    this.connection = connection;
  }

  async getDepartment(id, departmentId) {
    const dept = await this.repository.findById(id);
    if (!dept) throw new NotFoundError('Department not found');
    this._enforceDepartmentScope(dept, departmentId);
    return dept;
  }

  async getDepartments(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async createDepartment(data, requesterUserId) {
    const errors = [];
    if (!data || typeof data.name !== 'string' || data.name.trim().length === 0) errors.push({ field: 'name', message: 'Name is required' });
    else if (data.name.trim().length > 150) errors.push({ field: 'name', message: 'Name exceeds 150 characters' });
    if (!data || !data.code || typeof data.code !== 'string') errors.push({ field: 'code', message: 'Code is required' });
    else if (data.code.trim().length > 20) errors.push({ field: 'code', message: 'Code exceeds 20 characters' });
    if (errors.length > 0) throw new BadRequestError('Validation failed', errors);

    const codeUpper = data.code.toUpperCase();
    const exists = await this.repository.codeExists(codeUpper);
    if (exists) throw new ConflictError('Department code already exists');

    return this.connection.withTransaction(async (client) => {
      const dept = await this.repository.create({ name: data.name.trim(), code: codeUpper, description: data.description || null, status: data.status ? data.status.toUpperCase() : 'ACTIVE', createdBy: requesterUserId || null }, client);
      return dept;
    });
  }

  async updateDepartment(id, data, requesterDeptId) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Department not found');
    this._enforceDepartmentScope(existing, requesterDeptId);
    if (data.code !== undefined) {
      const exists = await this.repository.codeExists(data.code, id);
      if (exists) throw new ConflictError('Department code already exists');
    }
    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(id, { name: data.name, code: data.code, description: data.description, status: data.status }, client);
      if (!updated) throw new NotFoundError('Department not found during update');
      return updated;
    });
  }

  async deactivateDepartment(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Department not found');
    this._enforceDepartmentScope(existing, departmentId);
    if (existing.status === 'INACTIVE') throw new BadRequestError('Department is already inactive');
    return this.connection.withTransaction(async (client) => {
      const deactivated = await this.repository.deactivate(id, client);
      if (!deactivated) throw new NotFoundError('Department not found during deactivation');
      return deactivated;
    });
  }

  _enforceDepartmentScope(dept, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (dept.id !== departmentId) {
      throw new ForbiddenError('Access denied: department is outside your scope');
    }
  }
}

module.exports = DepartmentService;
