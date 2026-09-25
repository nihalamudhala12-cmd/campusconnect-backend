/**
 * Sample Routes
 * Step 6.7 — API Foundation Verification
 *
 * Demonstrates the Route → middleware → controller flow.
 * Mounts sample endpoints with authentication, RBAC, and validation.
 */

const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate, optionalAuthenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const SampleController = require('./sampleController');

const router = Router();

const sampleController = new SampleController(null);

const sampleSchema = {
  body: (body) => {
    const errors = [];
    if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required and must be a non-empty string' });
    }
    return errors;
  },
};

router.get('/samples', authenticate, authorize(['HOD', 'FACULTY', 'PRINCIPAL']), asyncHandler(async (req, res) => {
  sampleController.getSamples(req, res);
}));

router.get('/samples/:id', authenticate, authorize(['HOD', 'FACULTY', 'PRINCIPAL']), asyncHandler(async (req, res) => {
  sampleController.getSample(req, res);
}));

router.post('/samples', authenticate, authorize(['HOD', 'PRINCIPAL']), validateRequest(sampleSchema), asyncHandler(async (req, res) => {
  sampleController.createSample(req, res);
}));

router.put('/samples/:id', authenticate, authorize(['HOD', 'PRINCIPAL']), asyncHandler(async (req, res) => {
  sampleController.updateSample(req, res);
}));

router.delete('/samples/:id', authenticate, authorize(['HOD', 'PRINCIPAL']), asyncHandler(async (req, res) => {
  sampleController.deleteSample(req, res);
}));

module.exports = router;
