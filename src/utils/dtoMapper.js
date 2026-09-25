const { generateUUIDv7 } = require('../infrastructure/database/utils/uuid');

function toResponseEnvelope(data, message = 'Success', success = true) {
  return { success, message, data };
}

function toUserDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    departmentId: row.department_id,
    status: row.status,
    profileCompleted: row.profile_completed === true,
    createdAt: row.created_at,
  };
}

function toDepartmentDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toClassDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    departmentId: row.department_id,
    semester: row.semester,
    section: row.section,
    status: row.status,
    academicYear: row.academic_year,
    createdAt: row.created_at,
  };
}

function toCourseDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    departmentId: row.department_id,
    credits: row.credits,
    createdAt: row.created_at,
  };
}

function toAttendanceDto(row) {
  if (!row) return null;
  let dateStr = null;
  if (row.attendance_date) {
    if (row.attendance_date instanceof Date) {
      const y = row.attendance_date.getFullYear();
      const m = String(row.attendance_date.getMonth() + 1).padStart(2, '0');
      const d = String(row.attendance_date.getDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    } else {
      dateStr = String(row.attendance_date).slice(0, 10);
    }
  }
  return {
    id: row.id,
    studentId: row.student_id,
    facultyId: row.faculty_id,
    classId: row.class_id,
    courseId: row.course_id,
    attendance: row.attendance,
    attendanceDate: dateStr,
    date: dateStr,
    status: row.status,
    remarks: row.remarks,
    createdAt: row.created_at,
  };
}

function toResultDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    assessmentType: row.assessment_type,
    marksObtained: row.marks_obtained,
    maxMarks: row.max_marks,
    grade: row.grade,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toAnnouncementDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    departmentId: row.department_id,
    audience: row.audience,
    priority: row.priority,
    status: row.status,
    type: row.type,
    createdAt: row.created_at,
    publishAt: row.publish_at,
  };
}

function toApprovalDto(row) {
  if (!row) return null;

  return {
    id: row.id,
    type: row.type,
    requestedBy: row.requested_by,
    departmentId: row.department_id,
    description: row.description,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    remarks: row.remarks,
    createdAt: row.created_at,
  };
}

function toAnalyticsDto(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.userName,
    departmentId: row.department_id,
    rollNumber: row.roll_number,
    designation: row.designation,
    semester: row.semester,
    academicYear: row.academicYear,
    classId: row.class_id,
    className: row.className,
    facultyId: row.faculty_id,
    facultyName: row.facultyName,
    courseId: row.course_id,
    courseName: row.courseName,
    courseCode: row.courseCode,
    assessmentType: row.assessment_type,
    marksObtained: row.marks_obtained,
    maxMarks: row.max_marks,
    grade: row.grade,
    status: row.status,
    classCount: row.classcount,
    enrollmentCount: row.enrollmentcount,
    attendanceRate: row.attendancerate,
    totalSessions: row.totalsessions,
    scheduledSessions: row.scheduledsessions,
    attendedSessions: row.attendedsessions,
    presentCount: row.presentcount,
    absentCount: row.absentcount,
    excusedCount: row.excusedcount,
    totalRecords: row.totalrecords,
    studentCount: row.studentcount,
    averageScore: row.averagescore,
    totalAttendance: row.totalattendance,
    assessedCount: row.assessedcount,
  };
}

function toSessionDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    deviceFingerprint: row.device_fingerprint,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    isActive: row.is_active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
    departmentId: row.department_id,
    locationInfo: row.location_info,
  };
}

function toDeviceDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    deviceName: row.device_name,
    deviceType: row.device_type,
    deviceModel: row.device_model,
    osVersion: row.os_version,
    appVersion: row.app_version,
    pushToken: row.push_token,
    lastSeenAt: row.last_seen_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function toSystemConfigDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    academicYear: row.academicYear,
    timezone: row.timezone,
    language: row.language,
    theme: row.theme,
    contactEmail: row.contactEmail,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    secondaryColor: row.secondaryColor,
    welcomeMessage: row.welcomeMessage,
    footerText: row.footerText,
    enableNotifications: row.enableNotifications,
    notificationEmail: row.notificationEmail,
    maxFileUploadSize: row.maxFileUploadSize,
    allowedFileTypes: row.allowedFileTypes,
    sessionTimeout: row.sessionTimeout,
    passwordPolicy: row.passwordPolicy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
  };
}

function toNotificationDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedAnnouncementId: row.related_announcement_id,
    isRead: row.is_read,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

function toMessageDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    subject: row.subject,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

module.exports = {
  toResponseEnvelope,
  toUserDto,
  toDepartmentDto,
  toClassDto,
  toCourseDto,
  toAttendanceDto,
  toResultDto,
  toAnnouncementDto,
  toApprovalDto,
  toAnalyticsDto,
  toNotificationDto,
  toMessageDto,
  toSessionDto,
  toDeviceDto,
  toSystemConfigDto,
};
