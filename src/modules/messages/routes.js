const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { authenticate } = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/rbacMiddleware');
const validateRequest = require('../../middleware/validateRequest');

const router = express.Router();

let messageController = null;

function getController() {
  if (!messageController) {
    const MessageController = require('./messageController');
    const MessageService = require('./messageService');
    const MessageRepository = require('./messageRepository');
    const connection = require('../../infrastructure/database/connection');
    const messageRepository = new MessageRepository(connection.getPool());
    const messageService = new MessageService(messageRepository, connection);
    messageController = new MessageController(messageService);
  }
  return messageController;
}

const createMessageSchema = {
  body: require('./messageValidator').validateCreateMessage,
};

const updateMessageSchema = {
  body: require('./messageValidator').validateUpdateMessage,
};

const listMessagesSchema = {
  query: require('./messageValidator').validateListMessagesQuery,
};

const messageIdSchema = {
  params: require('./messageValidator').validateMessageIdParam,
};

router.get('/messages',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(listMessagesSchema),
  asyncHandler(async (req, res) => {
    await getController().getMessages(req, res);
  })
);

router.get('/messages/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(messageIdSchema),
  asyncHandler(async (req, res) => {
    await getController().getMessage(req, res);
  })
);

router.post('/messages',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL', 'STUDENT', 'PARENT']),
  validateRequest(createMessageSchema),
  asyncHandler(async (req, res) => {
    await getController().createMessage(req, res);
  })
);

router.put('/messages/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(messageIdSchema),
  validateRequest(updateMessageSchema),
  asyncHandler(async (req, res) => {
    await getController().updateMessage(req, res);
  })
);

router.delete('/messages/:id',
  authenticate,
  authorize(['HOD', 'FACULTY', 'PRINCIPAL']),
  validateRequest(messageIdSchema),
  asyncHandler(async (req, res) => {
    await getController().deleteMessage(req, res);
  })
);

module.exports = router;
