/**
 * Attendance Service
 * M6 — Attendance
 *
 * Contains business logic for attendance management.
 * Enforces department scoping, validates input, and orchestrates repository calls.
 * Transaction scope is owned by the service layer.
 */

const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');
const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_STATUSES = ['PRESENT', 'ABSENT', 'LATE'];

function validateIdOrCode(value, fieldName) {
  if (!validateUUID(value) && !validateCode(value)) {
    throw new BadRequestError('Validation failed', [{ field: fieldName, message: `${fieldName} must be a valid UUID or business code` }]);
  }
}

class AttendanceService extends BaseService {
  constructor(repository, connection) {
    super(repository);
    this.connection = connection;
  }

  async getAttendance(id, departmentId) {
    const attendance = await this.repository.findById(id);
    if (!attendance) {
      throw new NotFoundError('Attendance record not found');
    }
    this._enforceDepartmentScope(attendance, departmentId);
    return attendance;
  }

  async getAttendances(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async createAttendance(data, departmentId) {
    const errors = [];
    if (!data || !data.studentId) errors.push({ field: 'studentId', message: 'Student ID is required' });
    if (!data || !data.facultyId) errors.push({ field: 'facultyId', message: 'Faculty ID is required' });
    if (!data || !data.classId) errors.push({ field: 'classId', message: 'Class ID is required' });
    if (!data || !data.courseId) errors.push({ field: 'courseId', message: 'Course ID is required' });
    if (!data || !data.attendanceDate) errors.push({ field: 'attendanceDate', message: 'Attendance date is required' });
    if (!data || !data.status) errors.push({ field: 'status', message: 'Status is required' });
    if (errors.length > 0) throw new BadRequestError('Validation failed', errors);

    if (!VALID_STATUSES.includes(data.status.toUpperCase())) {
      throw new BadRequestError('Validation failed', [{ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` }]);
    }

    validateIdOrCode(data.studentId, 'studentId');
    validateIdOrCode(data.facultyId, 'facultyId');
    validateIdOrCode(data.classId, 'classId');
    validateIdOrCode(data.courseId, 'courseId');

    const studentUser = await this.repository.userExists(data.studentId);
    if (!studentUser) {
      throw new BadRequestError('Student user does not exist');
    }
    if (studentUser.role !== 'STUDENT') {
      throw new BadRequestError('Specified user is not a student');
    }

    const facultyUser = await this.repository.userExists(data.facultyId);
    if (!facultyUser) {
      throw new BadRequestError('Faculty user does not exist');
    }
    if (!['FACULTY', 'HOD'].includes(facultyUser.role)) {
      throw new BadRequestError('Specified user is not a faculty member');
    }

    const classRecord = await this.repository.classExists(data.classId);
    if (!classRecord) {
      throw new BadRequestError('Class does not exist');
    }

    if (departmentId !== 'ALL' && classRecord.department_id !== departmentId) {
      throw new ForbiddenError('Class is outside your department scope');
    }

    const courseExists = await this.repository.courseExists(data.courseId);
    if (!courseExists) {
      throw new BadRequestError('Course does not exist');
    }

    const duplicate = await this.repository.exists(data.studentId, data.classId, data.courseId, data.attendanceDate);
    if (duplicate) {
      throw new ConflictError('Attendance record already exists for this student, class, course, and date');
    }

    return this.connection.withTransaction(async (client) => {
      const attendance = await this.repository.create(
        {
          studentId: data.studentId,
          facultyId: data.facultyId,
          classId: data.classId,
          courseId: data.courseId,
          attendanceDate: data.attendanceDate,
          status: data.status.toUpperCase(),
          remarks: data.remarks,
        },
        client
      );
      return attendance;
    });
  }

  async updateAttendance(id, data, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Attendance record not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    const updateData = {};
    if (data.status !== undefined) {
      if (!VALID_STATUSES.includes(data.status.toUpperCase())) {
        throw new BadRequestError('Validation failed', [{ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` }]);
      }
      updateData.status = data.status.toUpperCase();
    }
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(id, updateData, client);
      if (!updated) {
        throw new NotFoundError('Attendance record not found during update');
      }
      return updated;
    });
  }

  async deleteAttendance(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Attendance record not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    return this.connection.withTransaction(async (client) => {
      const deleted = await this.repository.delete(id, client);
      if (!deleted) {
        throw new NotFoundError('Attendance record not found during deletion');
      }
      return deleted;
    });
  }

  _enforceDepartmentScope(attendance, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    const attendanceDeptId = attendance.class_department_id;
    if (attendanceDeptId !== departmentId) {
      throw new ForbiddenError('Access denied: attendance record is outside your department scope');
    }
  }
}

module.exports = AttendanceService;
