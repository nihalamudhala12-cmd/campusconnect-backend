/**
 * Announcement Controller
 * M8 — Announcements API
 *
 * Translates HTTP requests into service calls and formats canonical responses.
 * Extends BaseController for standardized response envelopes.
 */

const BaseController = require('../../controllers/baseController');
const { BadRequestError } = require('../../errors');
const { toAnnouncementDto } = require('../../utils/dtoMapper');

class AnnouncementController extends BaseController {
  constructor(announcementService) {
    super(announcementService);
    this.announcementService = announcementService;
  }

  async getAnnouncement(req, res) {
    const announcement = await this.announcementService.getAnnouncement(req.params.id, req.departmentId);
    return this.ok(res, toAnnouncementDto(announcement));
  }

  async getAnnouncements(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      audience: req.query.audience,
      status: req.query.status,
      type: req.query.type,
      priority: req.query.priority,
      search: req.query.search,
      createdBy: req.query.createdBy,
      departmentId: req.query.departmentId,
      publishBefore: req.query.publishBefore,
      publishAfter: req.query.publishAfter,
    };

    const result = await this.announcementService.getAnnouncements(req.departmentId, options);
    return res.json({
      success: true,
      message: 'Announcements retrieved',
      data: result.data.map(toAnnouncementDto),
      meta: result.meta,
    });
  }

  async createAnnouncement(req, res) {
    const announcement = await this.announcementService.createAnnouncement(
      req.body,
      req.user.id,
      req.user.role,
      req.departmentId
    );
    return this.created(res, toAnnouncementDto(announcement));
  }

  async updateAnnouncement(req, res) {
    const allowedFields = ['title', 'content', 'type', 'audience', 'status', 'priority', 'departmentId', 'publishAt'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields provided for update');
    }

    const announcement = await this.announcementService.updateAnnouncement(
      req.params.id,
      updateData,
      req.user.role,
      req.departmentId
    );
    return this.ok(res, toAnnouncementDto(announcement));
  }

  async updateAnnouncementStatus(req, res) {
    const { status } = req.body;
    if (!status) {
      throw new BadRequestError('Status is required');
    }

    const announcement = await this.announcementService.updateAnnouncementStatus(
      req.params.id,
      status,
      req.user.role,
      req.departmentId
    );
    return this.ok(res, toAnnouncementDto(announcement), 'Announcement status updated');
  }

  async authorizeInstitutionWide(req, res) {
    const announcement = await this.announcementService.authorizeInstitutionWide(
      req.params.id,
      req.user.role,
      req.departmentId
    );
    return this.ok(res, toAnnouncementDto(announcement), 'Announcement authorized for institution-wide publication');
  }

  async deactivateAnnouncement(req, res) {
    const announcement = await this.announcementService.deactivateAnnouncement(
      req.params.id,
      req.user.role,
      req.departmentId
    );
    return this.ok(res, toAnnouncementDto(announcement), 'Announcement deactivated successfully');
  }

  async deleteAnnouncement(req, res) {
    const announcement = await this.announcementService.deleteAnnouncement(
      req.params.id,
      req.user.role,
      req.departmentId
    );
    return this.ok(res, toAnnouncementDto(announcement), 'Announcement deleted successfully');
  }

  async getDepartmentAnnouncements(req, res) {
    const options = {
      page: req.query.page ? parseInt(req.query.page, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      audience: req.query.audience,
      status: req.query.status,
      type: req.query.type,
    };

    const result = await this.announcementService.getDepartmentAnnouncements(
      req.params.departmentId,
      options,
      req.user.role,
      req.departmentId
    );
    return res.json({
      success: true,
      message: 'Department announcements retrieved',
      data: result.data.map(toAnnouncementDto),
      meta: result.meta,
    });
  }
}

module.exports = AnnouncementController;