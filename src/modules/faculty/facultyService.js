/**
 * Faculty Service
 * M4 — Faculty
 */

const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');

class FacultyService extends BaseService {
  constructor(repository, connection) {
    super(repository);
    this.connection = connection;
  }

  async getFaculty(id, departmentId) {
    const faculty = await this.repository.findById(id);
    if (!faculty) {
      throw new NotFoundError('Faculty not found');
    }
    this._enforceDepartmentScope(faculty, departmentId);
    return faculty;
  }

  async getFacultyByUserId(userId, departmentId) {
    const faculty = await this.repository.findByUserId(userId);
    if (!faculty) {
      throw new NotFoundError('Faculty profile not found');
    }
    this._enforceDepartmentScope(faculty, departmentId);
    return faculty;
  }

  async getMyFaculty(userId, departmentId) {
    const faculty = await this.repository.findByUserId(userId);
    if (!faculty) {
      throw new NotFoundError('Faculty profile not found');
    }
    this._enforceDepartmentScope(faculty, departmentId);
    if (faculty.user_id !== userId) {
      throw new ForbiddenError('Access denied: faculty is outside your department scope');
    }
    return faculty;
  }

  async getFaculties(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async createFaculty(data, departmentId) {
    const errors = [];
    if (!data || !data.userId) errors.push({ field: 'userId', message: 'User ID is required' });
    if (errors.length > 0) throw new BadRequestError('Validation failed', errors);

    if (departmentId !== 'ALL' && data.departmentId !== departmentId) {
      throw new ForbiddenError('Cannot create faculty in a different department');
    }

    const userExists = await this.repository.userExists(data.userId);
    if (!userExists) {
      throw new BadRequestError('User with this ID does not exist or is not faculty/HOD');
    }

    const existing = await this.repository.getByUserId(data.userId);
    if (existing) {
      throw new ConflictError('A faculty profile already exists for this user');
    }

    return this.connection.withTransaction(async (client) => {
      const faculty = await this.repository.create(
        {
          userId: data.userId,
          employeeId: data.employeeId,
          designation: data.designation,
          status: data.status ? data.status.toUpperCase() : 'ACTIVE',
        },
        client
      );
      return faculty;
    });
  }

  async updateFaculty(id, data, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Faculty not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(
        id,
        {
          employeeId: data.employeeId,
          designation: data.designation,
          status: data.status,
        },
        client
      );

      if (!updated) {
        throw new NotFoundError('Faculty not found during update');
      }

      return updated;
    });
  }

  async deactivateFaculty(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Faculty not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    if (existing.status === 'INACTIVE') {
      throw new BadRequestError('Faculty profile is already inactive');
    }

    return this.connection.withTransaction(async (client) => {
      const deactivated = await this.repository.deactivate(id, client);
      if (!deactivated) {
        throw new NotFoundError('Faculty not found during deactivation');
      }
      return deactivated;
    });
  }

  _enforceDepartmentScope(faculty, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    const facultyDeptId = faculty.user_department_id || faculty.department_id;
    if (facultyDeptId !== departmentId) {
      throw new ForbiddenError('Access denied: faculty is outside your department scope');
    }
  }
}

module.exports = FacultyService;