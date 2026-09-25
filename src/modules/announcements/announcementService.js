/**
 * Announcement Service
 * M8 — Announcements API
 *
 * Contains business logic for announcement management.
 * Enforces department scoping, validates input, and orchestrates repository calls.
 * Transaction scope is owned by the service layer.
 */

const { BaseService } = require('../../services');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../../errors');

const VALID_AUDIENCES = ['DEPARTMENT', 'ALL', 'PENDING_INSTITUTION_WIDE'];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING_AUTHORIZATION'];
const VALID_TYPES = ['ANNOUNCEMENT', 'ALERT'];
const VALID_PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT'];

class AnnouncementService extends BaseService {
  constructor(announcementRepository, connection) {
    super(announcementRepository);
    this.connection = connection;
  }

  async getAnnouncement(id, departmentId) {
    const announcement = await this.repository.findById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement not found');
    }
    this._enforceDepartmentScope(announcement, departmentId);
    return announcement;
  }

  async getAnnouncements(departmentId, options = {}) {
    if (departmentId === 'ALL') {
      // PRINCIPAL can see all announcements
      if (options.audience === 'ALL') {
        return this.repository.findInstitutionWide(options);
      }
      if (options.audience === 'PENDING_INSTITUTION_WIDE') {
        return this.repository.findPendingAuthorization(options);
      }
      // For PRINCIPAL, use findAll with ALL scope
      return this.repository.findAll('ALL', options);
    }
    return this.repository.findAll(departmentId, options);
  }

  async createAnnouncement(data, requesterUserId, requesterRole, requesterDeptId) {
    const errors = [];
    if (!data || typeof data.title !== 'string' || data.title.trim().length === 0) errors.push({ field: 'title', message: 'Title is required' });
    else if (data.title.trim().length > 255) errors.push({ field: 'title', message: 'Title must not exceed 255 characters' });
    if (!data || typeof data.content !== 'string' || data.content.trim().length === 0) errors.push({ field: 'content', message: 'Content is required' });
    if (errors.length > 0) throw new BadRequestError('Validation failed', errors);

    const audience = (data.audience || 'DEPARTMENT').toUpperCase();
    if (!VALID_AUDIENCES.includes(audience)) {
      throw new BadRequestError(`Invalid audience: must be one of ${VALID_AUDIENCES.join(', ')}`);
    }

    const type = (data.type || 'ANNOUNCEMENT').toUpperCase();
    if (!VALID_TYPES.includes(type)) {
      throw new BadRequestError(`Invalid type: must be one of ${VALID_TYPES.join(', ')}`);
    }

    const priority = (data.priority || 'NORMAL').toUpperCase();
    if (!VALID_PRIORITIES.includes(priority)) {
      throw new BadRequestError(`Invalid priority: must be one of ${VALID_PRIORITIES.join(', ')}`);
    }

    let status = (data.status || 'ACTIVE').toUpperCase();
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestError(`Invalid status: must be one of ${VALID_STATUSES.join(', ')}`);
    }

    // Enforce audience rules based on role
    let departmentId = data.departmentId || requesterDeptId;

    if (audience === 'ALL') {
      // Only PRINCIPAL can create institution-wide announcements directly
      if (requesterRole !== 'PRINCIPAL') {
        throw new ForbiddenError('Only PRINCIPAL can create institution-wide announcements (audience=ALL)');
      }
      departmentId = null;
    } else if (audience === 'PENDING_INSTITUTION_WIDE') {
      // Only HOD/PRINCIPAL can request institution-wide sharing
      if (!['HOD', 'PRINCIPAL'].includes(requesterRole)) {
        throw new ForbiddenError('Only HOD or PRINCIPAL can request institution-wide sharing');
      }
      status = 'PENDING_AUTHORIZATION';
      // departmentId is preserved for PENDING_INSTITUTION_WIDE
      if (!departmentId) {
        throw new BadRequestError('Department ID is required for PENDING_INSTITUTION_WIDE audience');
      }
    } else if (audience === 'DEPARTMENT') {
      // DEPARTMENT audience requires a department
      if (!departmentId) {
        throw new BadRequestError('Department ID is required for DEPARTMENT audience');
      }
      // Non-PRINCIPAL can only create in their own department
      if (requesterRole !== 'PRINCIPAL' && departmentId !== requesterDeptId) {
        throw new ForbiddenError('Cannot create announcement in a different department');
      }
    }

    // Enforce status transitions
    if (status === 'PENDING_AUTHORIZATION' && audience !== 'PENDING_INSTITUTION_WIDE') {
      throw new BadRequestError('PENDING_AUTHORIZATION status only valid with PENDING_INSTITUTION_WIDE audience');
    }
    if (status === 'ACTIVE' && audience === 'PENDING_INSTITUTION_WIDE') {
      throw new BadRequestError('Cannot set ACTIVE status with PENDING_INSTITUTION_WIDE audience');
    }

    return this.connection.withTransaction(async (client) => {
      const announcement = await this.repository.create(
        {
          title: data.title.trim(),
          content: data.content.trim(),
          type,
          createdBy: requesterUserId,
          departmentId,
          audience,
          status,
          priority,
          publishAt: data.publishAt || null,
        },
        client
      );

      return announcement;
    });
  }

  async updateAnnouncement(id, data, requesterRole, requesterDeptId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Announcement not found');
    }

    // Check department scope for update
    this._enforceDepartmentScope(existing, requesterDeptId);

    // Determine new audience (if changing)
    const newAudience = data.audience ? data.audience.toUpperCase() : existing.audience;
    const newStatus = data.status ? data.status.toUpperCase() : existing.status;
    const newDepartmentId = data.departmentId !== undefined ? data.departmentId : existing.department_id;

    // Audience change rules
    if (data.audience !== undefined) {
      // Changing to ALL - only PRINCIPAL
      if (newAudience === 'ALL') {
        if (requesterRole !== 'PRINCIPAL') {
          throw new ForbiddenError('Only PRINCIPAL can change audience to institution-wide (ALL)');
        }
        // Department must be null for ALL
        if (newDepartmentId !== null) {
          throw new BadRequestError('Department ID must be null for ALL audience');
        }
      }
      // Changing to PENDING_INSTITUTION_WIDE - only HOD/PRINCIPAL
      else if (newAudience === 'PENDING_INSTITUTION_WIDE') {
        if (!['HOD', 'PRINCIPAL'].includes(requesterRole)) {
          throw new ForbiddenError('Only HOD or PRINCIPAL can request institution-wide sharing');
        }
        if (!newDepartmentId) {
          throw new BadRequestError('Department ID is required for PENDING_INSTITUTION_WIDE audience');
        }
        // Status must be PENDING_AUTHORIZATION
        if (newStatus !== 'PENDING_AUTHORIZATION') {
          throw new BadRequestError('PENDING_INSTITUTION_WIDE audience requires PENDING_AUTHORIZATION status');
        }
      }
      // Changing to DEPARTMENT
      else if (newAudience === 'DEPARTMENT') {
        if (!newDepartmentId) {
          throw new BadRequestError('Department ID is required for DEPARTMENT audience');
        }
        if (requesterRole !== 'PRINCIPAL' && newDepartmentId !== requesterDeptId) {
          throw new ForbiddenError('Cannot move announcement to a different department');
        }
      }
    }

    // Status change rules
    if (data.status !== undefined) {
      // Only PRINCIPAL can authorize PENDING_INSTITUTION_WIDE -> ALL
      if (existing.audience === 'PENDING_INSTITUTION_WIDE' && newAudience === 'ALL') {
        if (requesterRole !== 'PRINCIPAL') {
          throw new ForbiddenError('Only PRINCIPAL can authorize institution-wide publication');
        }
        // Department ID must be cleared
        if (newDepartmentId !== null) {
          throw new BadRequestError('Department ID must be cleared when authorizing for ALL audience');
        }
      }

      // Cannot set ACTIVE on PENDING_INSTITUTION_WIDE
      if (newAudience === 'PENDING_INSTITUTION_WIDE' && newStatus === 'ACTIVE') {
        throw new BadRequestError('Cannot set ACTIVE status with PENDING_INSTITUTION_WIDE audience');
      }

      // Cannot set PENDING_AUTHORIZATION without PENDING_INSTITUTION_WIDE audience
      if (newStatus === 'PENDING_AUTHORIZATION' && newAudience !== 'PENDING_INSTITUTION_WIDE') {
        throw new BadRequestError('PENDING_AUTHORIZATION status only valid with PENDING_INSTITUTION_WIDE audience');
      }
    }

    // Department change rules (for DEPARTMENT audience only)
    if (data.departmentId !== undefined && newAudience === 'DEPARTMENT') {
      if (requesterRole !== 'PRINCIPAL' && newDepartmentId !== requesterDeptId) {
        throw new ForbiddenError('Cannot move announcement to a different department');
      }
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(
        id,
        {
          title: data.title,
          content: data.content,
          type: data.type,
          departmentId: newDepartmentId,
          audience: newAudience,
          status: newStatus,
          priority: data.priority,
          publishAt: data.publishAt,
        },
        client
      );

      if (!updated) {
        throw new NotFoundError('Announcement not found during update');
      }

      return updated;
    });
  }

  async updateAnnouncementStatus(id, status, requesterRole, requesterDeptId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Announcement not found');
    }

    this._enforceDepartmentScope(existing, requesterDeptId);

    const newStatus = status.toUpperCase();
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new BadRequestError(`Invalid status: must be one of ${VALID_STATUSES.join(', ')}`);
    }

    // Enforce status transition rules
    // Cannot set ACTIVE on PENDING_INSTITUTION_WIDE audience (must use authorize endpoint)
    if (existing.audience === 'PENDING_INSTITUTION_WIDE' && newStatus === 'ACTIVE') {
      throw new BadRequestError('Cannot set ACTIVE status with PENDING_INSTITUTION_WIDE audience. Use authorize endpoint instead.');
    }
    // Cannot set PENDING_AUTHORIZATION without PENDING_INSTITUTION_WIDE audience
    if (newStatus === 'PENDING_AUTHORIZATION' && existing.audience !== 'PENDING_INSTITUTION_WIDE') {
      throw new BadRequestError('PENDING_AUTHORIZATION status only valid with PENDING_INSTITUTION_WIDE audience');
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.updateStatus(id, newStatus, client);
      if (!updated) {
        throw new NotFoundError('Announcement not found during status update');
      }
      return updated;
    });
  }

  async authorizeInstitutionWide(id, requesterRole, requesterDeptId) {
    if (requesterRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Only PRINCIPAL can authorize institution-wide publication');
    }

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Announcement not found');
    }

    if (existing.audience !== 'PENDING_INSTITUTION_WIDE') {
      throw new BadRequestError('Announcement is not pending institution-wide authorization');
    }

    if (existing.status !== 'PENDING_AUTHORIZATION') {
      throw new BadRequestError('Announcement is not in PENDING_AUTHORIZATION status');
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.updateAudience(id, 'ALL', null, client);
      if (!updated) {
        throw new NotFoundError('Announcement not found during authorization');
      }
      return updated;
    });
  }

  async deactivateAnnouncement(id, requesterRole, requesterDeptId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Announcement not found');
    }

    this._enforceDepartmentScope(existing, requesterDeptId);

    if (existing.status === 'INACTIVE') {
      throw new BadRequestError('Announcement is already inactive');
    }

    // Only PRINCIPAL can deactivate institution-wide announcements
    if (existing.audience === 'ALL' && requesterRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Only PRINCIPAL can deactivate institution-wide announcements');
    }

    return this.connection.withTransaction(async (client) => {
      const deactivated = await this.repository.deactivate(id, client);
      if (!deactivated) {
        throw new NotFoundError('Announcement not found during deactivation');
      }
      return deactivated;
    });
  }

  async deleteAnnouncement(id, requesterRole, requesterDeptId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Announcement not found');
    }

    // Only PRINCIPAL can permanently delete announcements
    if (requesterRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Only PRINCIPAL can permanently delete announcements');
    }

    return this.connection.withTransaction(async (client) => {
      const deleted = await this.repository.delete(id, client);
      if (!deleted) {
        throw new NotFoundError('Announcement not found during deletion');
      }
      return deleted;
    });
  }

  async getDepartmentAnnouncements(departmentId, options = {}, requesterRole, requesterDeptId) {
    if (requesterRole !== 'PRINCIPAL' && departmentId !== requesterDeptId) {
      throw new ForbiddenError('Cannot access announcements for a different department');
    }
    return this.repository.findByDepartment(departmentId, options);
  }

  _enforceDepartmentScope(announcement, departmentId) {
    if (departmentId === 'ALL') {
      return; // PRINCIPAL has institution-wide access
    }
    // For DEPARTMENT audience, must match department
    if (announcement.audience === 'DEPARTMENT' || announcement.audience === 'PENDING_INSTITUTION_WIDE') {
      if (announcement.department_id !== departmentId) {
        throw new ForbiddenError('Access denied: announcement is outside your department scope');
      }
    }
    // For ALL audience, any authenticated user can view (but scope check is on creation/update)
  }
}

module.exports = AnnouncementService;