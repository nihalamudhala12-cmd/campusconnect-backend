/**
 * AI Routes
 * /api/ai/* endpoints with rate limiting, authorization, and error envelopes.
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const AIOrchestrator = require('./aiService');
const { ToolRegistry } = require('./aiToolRegistry');
const { authenticate } = require('../../middleware/authMiddleware');

const aiOrchestrator = new AIOrchestrator({ toolRegistry: ToolRegistry });

/**
 * Rate limiter: 30 requests per 15 minutes per authenticated user
 */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter: 60 requests per 15 minutes per authenticated user (health)
 */
const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/ai/chat - Chat with AI assistant using trusted context
 * Authentication required; body must contain message text
 */
router.post(
  '/chat',
  authenticate,
  chatLimiter,
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }).withMessage('Message must not exceed 2000 characters'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() },
      });
    }

    try {
      const { message } = req.body;
      // Module context may arrive in the request body (canonical frontend
      // client) or the query string. Query takes precedence when present.
      const requestedModule = req.query.module || req.body.module || 'general';
      const response = await aiOrchestrator.processChat(req.user, message, {
        module: requestedModule,
        conversation: Array.isArray(req.body.conversation) ? req.body.conversation : [],
      });

      // Log the AI interaction for audit
      console.info(`AI chat request from user ${req.user.id} (role: ${req.user.role})`, {
        messageLength: message.length,
        toolCount: response.data.usedTools ? response.data.usedTools.length : 0,
        latencyMs: response.usage ? response.usage.latencyMs : 0,
      });

      return res.json(response);
    } catch (error) {
      console.error('AI chat error:', error);

      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';
      let message = 'Internal server error';

      if (error.message === 'User authentication required') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
        message = 'Authentication required';
      } else if (error.message === 'Message is required') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Message is required';
      } else if (error.message === 'Failed to build trusted AI context') {
        statusCode = 403;
        errorCode = 'CONTEXT_BUILD_FAILED';
        message = 'Failed to build trusted AI context';
      }

      return res.status(statusCode).json({
        success: false,
        error: { code: errorCode, message, details: 'Internal server error' },
      });
    }
  }
);

/**
 * POST /api/ai/chat-simple - Simple chat without tool calls
 * Authentication required; body must contain message text
 */
router.post(
  '/chat-simple',
  authenticate,
  chatLimiter,
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }).withMessage('Message must not exceed 2000 characters'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array() },
      });
    }

    try {
      const { message } = req.body;
      const requestedModule = req.query.module || req.body.module || 'general';
      const response = await aiOrchestrator.processChatSimple(req.user, message, {
        module: requestedModule,
        conversation: Array.isArray(req.body.conversation) ? req.body.conversation : [],
      });

      console.info(`AI chat-simple request from user ${req.user.id} (role: ${req.user.role})`, {
        messageLength: message.length,
        latencyMs: response.usage.latencyMs,
      });

      return res.json(response);
    } catch (error) {
      console.error('AI chat-simple error:', error);

      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';
      let message = 'Internal server error';

      if (error.message === 'User authentication required') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
        message = 'Authentication required';
      } else if (error.message === 'Message is required') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Message is required';
      }

      return res.status(statusCode).json({
        success: false,
        error: { code: errorCode, message, details: 'Internal server error' },
      });
    }
  }
);

/**
 * GET /api/ai/health - Health check for the AI assistant service
 */
router.get('/health', authenticate, healthLimiter, async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        status: 'ok',
        authenticated: true,
        user: {
          id: req.user.id,
          role: req.user.role,
          departmentId: req.user.departmentId,
        },
        aiService: {
          available: true,
          provider: 'local',
          configured: true,
        },
      },
    });
  } catch (error) {
    console.error('AI health check error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: 'Internal server error' },
    });
  }
});

/**
 * GET /api/ai/config - Config for the AI assistant service (non-sensitive)
 * Authentication required; returns provider and model
 */
router.get('/config', authenticate, healthLimiter, async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        provider: 'local',
        model: 'campusconnect-local-v1',
      },
    });
  } catch (error) {
    console.error('AI config error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: 'Internal server error' },
    });
  }
});

module.exports = router;
