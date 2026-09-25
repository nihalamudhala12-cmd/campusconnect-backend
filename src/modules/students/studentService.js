/**
 * Student Service
 * M3 — Students
 *
 * Contains business logic for student management.
 * Enforces department scoping, validates input, and orchestrates repository calls.
 * Transaction scope is owned by the service layer.
 */

const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');

class StudentService extends BaseService {
  constructor(repository, connection) {
    super(repository);
    this.connection = connection;
  }

  async getStudent(id, departmentId) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new NotFoundError('Student not found');
    }
    this._enforceDepartmentScope(student, departmentId);
    return student;
  }

  async getStudents(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async getStudentByUserId(userId, departmentId) {
    const student = await this.repository.findByUserId(userId);
    if (!student) {
      throw new NotFoundError('Student profile not found');
    }
    this._enforceDepartmentScope(student, departmentId);
    return student;
  }

  async getMyStudent(userId, departmentId) {
    const student = await this.repository.findByUserId(userId);
    if (!student) {
      throw new NotFoundError('Student profile not found');
    }
    this._enforceDepartmentScope(student, departmentId);
    if (student.user_id !== userId) {
      throw new ForbiddenError('Access denied: student is outside your department scope');
    }
    return student;
  }

  async createStudent(data, departmentId) {
    const errors = [];
    if (!data || !data.userId) errors.push({ field: 'userId', message: 'User ID is required' });
    if (errors.length > 0) throw new BadRequestError('Validation failed', errors);

    if (departmentId !== 'ALL' && data.departmentId !== departmentId) {
      throw new ForbiddenError('Cannot create student in a different department');
    }

    const userExists = await this.repository.userExists(data.userId);
    if (!userExists) {
      throw new BadRequestError('User with this ID does not exist or is not a student');
    }

    const existing = await this.repository.getByUserId(data.userId);
    if (existing) {
      throw new ConflictError('A student profile already exists for this user');
    }

    return this.connection.withTransaction(async (client) => {
      const student = await this.repository.create(
        {
          userId: data.userId,
          rollNumber: data.rollNumber,
          admissionNumber: data.admissionNumber,
          semester: data.semester,
          status: data.status ? data.status.toUpperCase() : 'ACTIVE',
        },
        client
      );
      return student;
    });
  }

  async updateStudent(id, data, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Student not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(
        id,
        {
          rollNumber: data.rollNumber,
          admissionNumber: data.admissionNumber,
          semester: data.semester,
          status: data.status,
        },
        client
      );

      if (!updated) {
        throw new NotFoundError('Student not found during update');
      }

      return updated;
    });
  }

  async deactivateStudent(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Student not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    if (existing.status === 'INACTIVE') {
      throw new BadRequestError('Student profile is already inactive');
    }

    return this.connection.withTransaction(async (client) => {
      const deactivated = await this.repository.deactivate(id, client);
      if (!deactivated) {
        throw new NotFoundError('Student not found during deactivation');
      }
      return deactivated;
    });
  }

  _enforceDepartmentScope(student, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    const studentDeptId = student.user_department_id || student.department_id;
    if (studentDeptId !== departmentId) {
      throw new ForbiddenError('Access denied: student is outside your department scope');
    }
  }
}

module.exports = StudentService;