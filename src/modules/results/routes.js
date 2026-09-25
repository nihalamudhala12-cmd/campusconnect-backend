/**
 * Result Routes
 * M7 — Results
 */

const { Router } = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');
const {
  validateCreateResult,
  validateUpdateResult,
  validateListResultsQuery,
  validateResultIdParam,
} = require('./resultValidator');

const router = Router();

let resultController = null;
function getController() {
  if (!resultController) {
    const ResultController = require('./resultController');
    const ResultService = require('./resultService');
    const ResultRepository = require('./resultRepository');
    const connection = require('../../infrastructure/database/connection');
    const repo = new ResultRepository(connection.getPool());
    const service = new ResultService(repo, connection);
    resultController = new ResultController(service);
  }
  return resultController;
}

const createResultSchema = {
  body: validateCreateResult,
};

const updateResultSchema = {
  body: validateUpdateResult,
};

const listResultsSchema = {
  query: validateListResultsQuery,
};

const resultIdSchema = {
  params: validateResultIdParam,
};

router.get('/results',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(listResultsSchema),
  asyncHandler(async (req, res) => {
    await getController().getResults(req, res);
  })
);

router.get('/results/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(resultIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getResult(req, res);
  })
);

router.post('/results',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(createResultSchema),
  asyncHandler(async (req, res) => {
    await getController().createResult(req, res);
  })
);

router.put('/results/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(resultIdSchema),
  validateRequest(updateResultSchema),
  asyncHandler(async (req, res) => {
    await getController().updateResult(req, res);
  })
);

router.delete('/results/:id',
  authenticate,
  authorize(['HOD', 'PRINCIPAL']),
  validateRequest(resultIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deleteResult(req, res);
  })
);

module.exports = router;