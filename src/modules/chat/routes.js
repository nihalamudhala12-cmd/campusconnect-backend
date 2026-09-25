const express = require('express');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

router.get('/chat',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  asyncHandler(async (req, res) => {
    res.json({ success: true, message: 'Chat endpoint stub', data: [] });
  })
);

module.exports = router;
