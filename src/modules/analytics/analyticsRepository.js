const BaseRepository = require('../../repositories/baseRepository');

class AnalyticsRepository extends BaseRepository {
  async getStudentPerformanceAnalytics(departmentId, options, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (departmentId !== 'ALL') {
      whereClause += ` AND u.department_id = $${queryParams.length + 1}`;
      queryParams.push(departmentId);
    }

    if (options.semester) {
      whereClause += ` AND sp.semester = $${queryParams.length + 1}`;
      queryParams.push(options.semester);
    }

    const countQuery = `SELECT COUNT(*)::int as total FROM student_profiles sp JOIN users u ON sp.user_id = u.id ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT
                        sp.id,
                        sp.user_id,
                        u.name as userName,
                        sp.roll_number,
                        sp.semester,
                        NULL as academicYear,
                        COUNT(DISTINCT se.class_id) as classCount,
                        COUNT(se.id) as enrollmentCount,
                        CASE
                          WHEN COUNT(se.id) > 0 THEN COUNT(
                            CASE
                              WHEN se.status = 'PRESENT' THEN 1
                              ELSE NULL
                            END
                          )::decimal / COUNT(se.id)
                          ELSE 0
                        END as attendanceRate
                       FROM student_profiles sp
                       JOIN users u ON sp.user_id = u.id
                       LEFT JOIN attendance se ON sp.user_id = se.student_id
                       ${whereClause}
                       GROUP BY sp.id, sp.user_id, u.name, sp.roll_number, sp.semester
                       ORDER BY sp.semester
                       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getFacultyStatsAnalytics(departmentId, options, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (departmentId !== 'ALL') {
      whereClause += ` AND u.department_id = $${queryParams.length + 1}`;
      queryParams.push(departmentId);
    }

    const countQuery = `SELECT COUNT(*)::int as total FROM faculty_profiles f JOIN users u ON f.user_id = u.id ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT
                        f.id,
                        f.user_id,
                        u.name as userName,
                        u.department_id,
                        f.designation,
                        f.status,
                        COUNT(DISTINCT tse.id) as totalSessions,
                        COUNT(DISTINCT tse.id) as scheduledSessions,
                        COUNT(DISTINCT
                          CASE
                            WHEN tse.status = 'ACTIVE' THEN 1
                            ELSE NULL
                          END
                        ) as activeSessions
                       FROM faculty_profiles f
                       JOIN users u ON f.user_id = u.id
                       LEFT JOIN timetable_entries tse ON f.user_id = tse.faculty_id
                       ${whereClause}
                       GROUP BY f.id, f.user_id, u.name, u.department_id, f.designation, f.status
                       ORDER BY u.name ASC
                       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getAttendanceAnalytics(departmentId, options, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (departmentId !== 'ALL') {
      whereClause += ` AND c.department_id = $${queryParams.length + 1}`;
      queryParams.push(departmentId);
    }

    if (options.semester) {
      whereClause += ` AND c.semester = $${queryParams.length + 1}`;
      queryParams.push(options.semester);
    }

    if (options.status) {
      whereClause += ` AND a.status = $${queryParams.length + 1}`;
      queryParams.push(options.status.toUpperCase());
    }

    const countQuery = `SELECT COUNT(*)::int as total FROM attendance a JOIN classes c ON a.class_id = c.id ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT
                        a.class_id,
                        c.name as className,
                        c.semester,
                        a.faculty_id,
                        u.name as facultyName,
                        COUNT(
                          CASE
                            WHEN a.status = 'PRESENT' THEN 1
                            ELSE NULL
                          END
                        ) as presentCount,
                        COUNT(
                          CASE
                            WHEN a.status = 'ABSENT' THEN 1
                            ELSE NULL
                          END
                        ) as absentCount,
                        COUNT(
                          CASE
                            WHEN a.status = 'LATE' THEN 1
                            ELSE NULL
                          END
                        ) as lateCount,
                        COUNT(*) as totalRecords
                       FROM attendance a
                       JOIN classes c ON a.class_id = c.id
                       LEFT JOIN users u ON a.faculty_id = u.id
                       ${whereClause}
                       GROUP BY a.class_id, c.name, c.semester, a.faculty_id, u.name
                       ORDER BY c.semester, c.name
                       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getResultsAnalytics(departmentId, options, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (departmentId !== 'ALL') {
      whereClause += ` AND c.department_id = $${queryParams.length + 1}`;
      queryParams.push(departmentId);
    }

    if (options.semester) {
      whereClause += ` AND r.semester = $${queryParams.length + 1}`;
      queryParams.push(options.semester);
    }

    if (options.academicYear) {
      whereClause += ` AND r.academic_year = $${queryParams.length + 1}`;
      queryParams.push(options.academicYear);
    }

    if (options.assessmentType) {
      whereClause += ` AND r.assessment_type = $${queryParams.length + 1}`;
      queryParams.push(options.assessmentType);
    }

    const countQuery = `SELECT COUNT(*)::int as total FROM results r ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT
                        r.id,
                        r.student_id,
                        r.course_id,
                        c.name as courseName,
                        c.code as courseCode,
                        r.assessment_type as assessmentType,
                        r.semester,
                        r.academic_year as academicYear,
                        r.marks_obtained,
                        r.max_marks,
                        r.grade,
                        r.status,
                        c.department_id as courseDepartmentId
                       FROM results r
                       JOIN courses c ON r.course_id = c.id
                       ${whereClause}
                       ORDER BY r.semester, r.academic_year
                       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getCrossDomainAnalytics(options, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (options.semesters) {
      const semesters = options.semesters.split(',').map(s => s.trim()).filter(Boolean);
      if (semesters.length > 0) {
        const placeholders = semesters.map((_, i) => `$${queryParams.length + i + 1}`).join(', ');
        whereClause += ` AND sp.semester IN (${placeholders})`;
        queryParams.push(...semesters);
      }
    }

    if (options.academicYears) {
      const academicYears = options.academicYears.split(',').map(y => y.trim()).filter(Boolean);
      if (academicYears.length > 0) {
        const placeholders = academicYears.map((_, i) => `$${queryParams.length + i + 1}`).join(', ');
        whereClause += ` AND r.academic_year IN (${placeholders})`;
        queryParams.push(...academicYears);
      }
    }

    if (options.departmentIds) {
      const departmentIds = options.departmentIds.split(',').map(d => d.trim()).filter(Boolean);
      if (departmentIds.length > 0) {
        const placeholders = departmentIds.map((_, i) => `$${queryParams.length + i + 1}`).join(', ');
        whereClause += ` AND u.department_id IN (${placeholders})`;
        queryParams.push(...departmentIds);
      }
    }

    const countQuery = `SELECT COUNT(*)::int as total FROM student_profiles sp JOIN users u ON sp.user_id = u.id LEFT JOIN attendance se ON sp.user_id = se.student_id LEFT JOIN results r ON sp.user_id = r.student_id ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT
                        sp.id,
                        sp.semester,
                        NULL as academicYear,
                        sp.user_id,
                        u.name as userName,
                        cls.department_id,
                        COUNT(DISTINCT se.id) as enrollmentCount,
                        COUNT(DISTINCT
                          CASE
                            WHEN se.status = 'PRESENT' THEN 1
                            ELSE NULL
                          END
                        ) as totalAttendance,
                        COUNT(DISTINCT
                          CASE
                            WHEN r.marks_obtained IS NOT NULL THEN 1
                            ELSE NULL
                          END
                        ) as assessedCount,
                        ROUND(AVG(
                          CASE
                            WHEN r.marks_obtained IS NOT NULL THEN r.marks_obtained::decimal / r.max_marks * 100
                            ELSE NULL
                          END
                        ), 2) as averageScore
                       FROM student_profiles sp
                       JOIN users u ON sp.user_id = u.id
                       LEFT JOIN attendance se ON sp.user_id = se.student_id
                       LEFT JOIN classes cls ON se.class_id = cls.id
                       LEFT JOIN results r ON sp.user_id = r.student_id
                       ${whereClause}
                       GROUP BY sp.id, sp.semester, sp.user_id, u.name, cls.department_id
                       ORDER BY sp.semester
                       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getDepartmentComparisonAnalytics(departmentId, options, client = null) {
    const runner = this.getRunner(client);

    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (departmentId !== 'ALL') {
      whereClause += ` AND c.department_id = $${queryParams.length + 1}`;
      queryParams.push(departmentId);
    }

    const countQuery = `SELECT COUNT(*)::int as total FROM student_profiles sp JOIN attendance e ON sp.user_id = e.student_id JOIN classes c ON e.class_id = c.id ${whereClause}`;
    const countResult = await runner.query(countQuery, queryParams);
    const total = countResult.rows[0].total;

    const dataQuery = `SELECT
                        sp.semester,
                        NULL as academicYear,
                        COUNT(DISTINCT sp.id) as studentCount,
                        ROUND(AVG(
                          CASE
                            WHEN r.marks_obtained IS NOT NULL THEN r.marks_obtained::decimal / r.max_marks * 100
                            ELSE NULL
                          END
                        ), 2) as averageScore,
                        COUNT(
                          CASE
                            WHEN e.status = 'PRESENT' THEN 1
                            ELSE NULL
                          END
                        ) as totalAttendance,
                        COUNT(DISTINCT e.id) as enrollmentCount
                       FROM student_profiles sp
                       JOIN attendance e ON sp.user_id = e.student_id
                       JOIN classes c ON e.class_id = c.id
                       LEFT JOIN results r ON sp.user_id = r.student_id
                       ${whereClause}
                       GROUP BY sp.semester
                       ORDER BY sp.semester
                       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const dataResult = await runner.query(dataQuery, [...queryParams, limit, offset]);

    return {
      data: dataResult.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

module.exports = AnalyticsRepository;
