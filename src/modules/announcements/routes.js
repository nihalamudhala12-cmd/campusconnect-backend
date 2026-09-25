/**
 * Announcement Routes
 * M8 — Announcements API
 *
 * Route definitions for announcement management endpoints.
 * Middleware order: validateRequest → authenticate → authorize → asyncHandler → controller
 *
 * Uses lazy controller initialization so the controller is created
 * with a real service only when the first request arrives (after
 * database initialization).
 */

const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const {
  validateCreateAnnouncement,
  validateUpdateAnnouncement,
  validateListAnnouncementsQuery,
  validateAnnouncementIdParam,
  validateStatusUpdate,
} = require('./announcementValidator');

const router = Router();

let announcementController = null;

function getController() {
  if (!announcementController) {
    const AnnouncementController = require('./announcementController');
    const AnnouncementService = require('./announcementService');
    const AnnouncementRepository = require('./announcementRepository');
    const connection = require('../../infrastructure/database/connection');
    const repo = new AnnouncementRepository(connection.getPool());
    const service = new AnnouncementService(repo, connection);
    announcementController = new AnnouncementController(service);
  }
  return announcementController;
}

const createAnnouncementSchema = {
  body: validateCreateAnnouncement,
};

const updateAnnouncementSchema = {
  body: validateUpdateAnnouncement,
};

const listAnnouncementsSchema = {
  query: validateListAnnouncementsQuery,
};

const announcementIdSchema = {
  params: validateAnnouncementIdParam,
};

const statusUpdateSchema = {
  body: validateStatusUpdate,
};

// GET /announcements - List announcements (with filters)
router.get('/announcements',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(listAnnouncementsSchema),
  asyncHandler(async (req, res) => {
    await getController().getAnnouncements(req, res);
  })
);

// GET /announcements/:id - Get single announcement
router.get('/announcements/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(announcementIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getAnnouncement(req, res);
  })
);

// POST /announcements - Create announcement
router.post('/announcements',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']), // HOD can create DEPARTMENT, PRINCIPAL can create ALL
  validateRequest(createAnnouncementSchema),
  asyncHandler(async (req, res) => {
    await getController().createAnnouncement(req, res);
  })
);

// PUT /announcements/:id - Update announcement
router.put('/announcements/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']), // HOD can update department announcements, PRINCIPAL can update all
  validateRequest(announcementIdSchema),
  validateRequest(updateAnnouncementSchema),
  asyncHandler(async (req, res) => {
    await getController().updateAnnouncement(req, res);
  })
);

// PATCH /announcements/:id/status - Update announcement status
router.patch('/announcements/:id/status',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(announcementIdSchema),
  validateRequest(statusUpdateSchema),
  asyncHandler(async (req, res) => {
    await getController().updateAnnouncementStatus(req, res);
  })
);

// POST /announcements/:id/authorize - Authorize for institution-wide (PRINCIPAL only)
router.post('/announcements/:id/authorize',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(announcementIdSchema),
  asyncHandler(async (req, res) => {
    await getController().authorizeInstitutionWide(req, res);
  })
);

// DELETE /announcements/:id - Deactivate announcement (soft delete)
router.delete('/announcements/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(announcementIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deactivateAnnouncement(req, res);
  })
);

// Hard delete (PRINCIPAL only) - separate endpoint for permanent deletion
router.delete('/announcements/:id/permanent',
  authenticate,
  authorize(['PRINCIPAL']),
  validateRequest(announcementIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deleteAnnouncement(req, res);
  })
);

// GET /departments/:departmentId/announcements - Get announcements for a specific department
router.get('/departments/:departmentId/announcements',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest({
    params: (params) => {
      const errors = [];
      if (!params.departmentId) {
        errors.push({ field: 'departmentId', message: 'Department ID is required' });
      }
      return errors;
    },
    query: validateListAnnouncementsQuery,
  }),
  asyncHandler(async (req, res) => {
    await getController().getDepartmentAnnouncements(req, res);
  })
);

module.exports = router;