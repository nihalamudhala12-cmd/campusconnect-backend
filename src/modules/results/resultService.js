/**
 * Result Service
 * M7 — Results
 *
 * Contains business logic for result/marks/grade management.
 * Enforces department scoping, validates input, and orchestrates repository calls.
 * Transaction scope is owned by the service layer.
 */

const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');
const { validateUUID, validateCode } = require('../../utils/idMapper');

const VALID_ASSESSMENT_TYPES = ['ASSIGNMENT', 'CLASS_TEST', 'MID_TERM', 'END_TERM', 'LAB', 'PROJECT', 'PRESENTATION', 'PARTICIPATION'];
const VALID_STATUSES = ['DRAFT', 'SUBMITTED', 'PUBLISHED', 'REVISION_PENDING'];

function validateIdOrCode(value, fieldName) {
  if (!validateUUID(value) && !validateCode(value)) {
    throw new BadRequestError('Validation failed', [{ field: fieldName, message: `${fieldName} must be a valid UUID or business code` }]);
  }
}

function validateAcademicYear(academicYear) {
  if (!academicYear || typeof academicYear !== 'string') {
    return false;
  }
  const pattern = /^\d{4}-\d{2}$/;
  if (!pattern.test(academicYear)) {
    return false;
  }
  const [startYearStr, endYearStr] = academicYear.split('-');
  const startYear = parseInt(startYearStr, 10);
  const endYear = parseInt(endYearStr, 10);
  const expectedEndYear = (startYear + 1) % 100;
  return endYear === expectedEndYear;
}

class ResultService extends BaseService {
  constructor(repository, connection) {
    super(repository);
    this.connection = connection;
  }

  async getResult(id, departmentId) {
    const result = await this.repository.findById(id);
    if (!result) {
      throw new NotFoundError('Result not found');
    }
    this._enforceDepartmentScope(result, departmentId);
    return result;
  }

  async getResults(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
  }

  async createResult(data, departmentId) {
    const errors = [];
    if (!data || !data.studentId) errors.push({ field: 'studentId', message: 'Student ID is required' });
    if (!data || !data.courseId) errors.push({ field: 'courseId', message: 'Course ID is required' });
    if (!data || !data.assessmentType) errors.push({ field: 'assessmentType', message: 'Assessment type is required' });
    if (!data || data.semester === undefined || data.semester === null || data.semester === '') errors.push({ field: 'semester', message: 'Semester is required' });
    if (!data || !data.academicYear) errors.push({ field: 'academicYear', message: 'Academic year is required' });
    if (!data || data.maxMarks === undefined || data.maxMarks === null) errors.push({ field: 'maxMarks', message: 'Max marks is required' });
    if (errors.length > 0) throw new BadRequestError('Validation failed', errors);

    if (!VALID_ASSESSMENT_TYPES.includes(data.assessmentType.toUpperCase())) {
      throw new BadRequestError('Validation failed', [{ field: 'assessmentType', message: `Assessment type must be one of: ${VALID_ASSESSMENT_TYPES.join(', ')}` }]);
    }

    if (!VALID_STATUSES.includes((data.status || 'PUBLISHED').toUpperCase())) {
      throw new BadRequestError('Validation failed', [{ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` }]);
    }

    if (!validateAcademicYear(data.academicYear)) {
      throw new BadRequestError('Validation failed', [{ field: 'academicYear', message: 'Academic year must be in format YYYY-YY (e.g., 2026-27)' }]);
    }

    const semester = parseInt(data.semester, 10);
    if (Number.isNaN(semester) || semester < 1 || semester > 10) {
      throw new BadRequestError('Validation failed', [{ field: 'semester', message: 'Semester must be an integer between 1 and 10' }]);
    }

    const maxMarks = Number(data.maxMarks);
    if (Number.isNaN(maxMarks) || maxMarks <= 0) {
      throw new BadRequestError('Validation failed', [{ field: 'maxMarks', message: 'Max marks must be a positive number' }]);
    }

    if (data.marksObtained !== undefined && data.marksObtained !== null) {
      const marksObtained = Number(data.marksObtained);
      if (Number.isNaN(marksObtained) || marksObtained < 0) {
        throw new BadRequestError('Validation failed', [{ field: 'marksObtained', message: 'Marks obtained must be a non-negative number' }]);
      }
      if (marksObtained > maxMarks) {
        throw new BadRequestError('Validation failed', [{ field: 'marksObtained', message: 'Marks obtained cannot exceed max marks' }]);
      }
    }

    validateIdOrCode(data.studentId, 'studentId');
    validateIdOrCode(data.courseId, 'courseId');

    const studentUser = await this.repository.userExists(data.studentId);
    if (!studentUser) {
      throw new BadRequestError('Student user does not exist');
    }
    if (studentUser.role !== 'STUDENT') {
      throw new BadRequestError('Specified user is not a student');
    }

    const studentProfile = await this.repository.studentExists(data.studentId);
    if (!studentProfile) {
      throw new BadRequestError('Student profile does not exist');
    }

    const courseRecord = await this.repository.courseExists(data.courseId);
    if (!courseRecord) {
      throw new BadRequestError('Course does not exist');
    }

    if (departmentId !== 'ALL' && courseRecord.department_id !== departmentId) {
      throw new ForbiddenError('Course is outside your department scope');
    }

    const duplicate = await this.repository.exists(
      data.studentId,
      data.courseId,
      data.assessmentType,
      semester,
      data.academicYear
    );
    if (duplicate) {
      throw new ConflictError('Result already exists for this student, course, assessment type, semester, and academic year');
    }

    return this.connection.withTransaction(async (client) => {
      const result = await this.repository.create(
        {
          studentId: data.studentId,
          courseId: data.courseId,
          assessmentType: data.assessmentType.toUpperCase(),
          semester,
          academicYear: data.academicYear,
          marksObtained: data.marksObtained !== undefined && data.marksObtained !== null ? data.marksObtained : null,
          maxMarks,
          grade: data.grade || null,
          status: data.status ? data.status.toUpperCase() : 'PUBLISHED',
        },
        client
      );
      return result;
    });
  }

  async updateResult(id, data, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Result not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    const updateData = {};

    if (data.marksObtained !== undefined) {
      if (data.marksObtained !== null) {
        const marksObtained = Number(data.marksObtained);
        if (Number.isNaN(marksObtained) || marksObtained < 0) {
          throw new BadRequestError('Validation failed', [{ field: 'marksObtained', message: 'Marks obtained must be a non-negative number' }]);
        }
        if (marksObtained > Number(existing.max_marks)) {
          throw new BadRequestError('Validation failed', [{ field: 'marksObtained', message: 'Marks obtained cannot exceed max marks' }]);
        }
        updateData.marksObtained = marksObtained;
      } else {
        updateData.marksObtained = null;
      }
    }

    if (data.maxMarks !== undefined) {
      const maxMarks = Number(data.maxMarks);
      if (Number.isNaN(maxMarks) || maxMarks <= 0) {
        throw new BadRequestError('Validation failed', [{ field: 'maxMarks', message: 'Max marks must be a positive number' }]);
      }
      const currentMarks = data.marksObtained !== undefined ? (data.marksObtained !== null ? Number(data.marksObtained) : null) : (existing.marks_obtained !== null ? Number(existing.marks_obtained) : null);
      if (currentMarks !== null && currentMarks > maxMarks) {
        throw new BadRequestError('Validation failed', [{ field: 'maxMarks', message: 'Max marks cannot be less than marks obtained' }]);
      }
      updateData.maxMarks = maxMarks;
    }

    if (data.grade !== undefined) {
      updateData.grade = data.grade || null;
    }

    if (data.status !== undefined) {
      if (!VALID_STATUSES.includes(data.status.toUpperCase())) {
        throw new BadRequestError('Validation failed', [{ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` }]);
      }
      updateData.status = data.status.toUpperCase();
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(id, updateData, client);
      if (!updated) {
        throw new NotFoundError('Result not found during update');
      }
      return updated;
    });
  }

  async deleteResult(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Result not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

    return this.connection.withTransaction(async (client) => {
      const deleted = await this.repository.delete(id, client);
      if (!deleted) {
        throw new NotFoundError('Result not found during deletion');
      }
      return deleted;
    });
  }

  _enforceDepartmentScope(result, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    const resultDeptId = result.course_department_id;
    if (resultDeptId !== departmentId) {
      throw new ForbiddenError('Access denied: result is outside your department scope');
    }
  }
}

module.exports = ResultService;