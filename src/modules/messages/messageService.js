const { BaseService } = require('../../services');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../errors');
const { toMessageDto } = require('../../utils/dtoMapper');

class MessageService extends BaseService {
  constructor(messageRepository, connection) {
    super(messageRepository);
    this.connection = connection;
  }

  async getMessage(id, userId, userRole, departmentId) {
    const message = await this.repository.findById(id);
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    
    const isParticipant = message.sender_id === userId || message.receiver_id === userId;
    const isPrivileged = userRole === 'PRINCIPAL' || (['HOD', 'FACULTY'].includes(userRole) && departmentId !== 'ALL');
    
    if (!isParticipant && !isPrivileged) {
      throw new ForbiddenError('Access denied: you are not a participant in this message');
    }
    
    if (!isParticipant && isPrivileged && departmentId !== 'ALL') {
      const pool = this.connection.getPool();
      const senderResult = await pool.query(
        'SELECT department_id FROM users WHERE id = $1',
        [message.sender_id]
      );
      if (senderResult.rowCount === 0) {
        throw new NotFoundError('Sender not found');
      }
      const senderDept = senderResult.rows[0].department_id;
      
      const receiverResult = await pool.query(
        'SELECT department_id FROM users WHERE id = $1',
        [message.receiver_id]
      );
      if (receiverResult.rowCount === 0) {
        throw new NotFoundError('Receiver not found');
      }
      const receiverDept = receiverResult.rows[0].department_id;
      
      if (senderDept !== departmentId && receiverDept !== departmentId) {
        throw new ForbiddenError('Access denied: message is outside your department scope');
      }
    }
    
    return message;
  }

  async getMessages(userId, departmentId, options = {}) {
    return this.repository.findAll(userId, departmentId, options);
  }

  async createMessage(data, departmentId) {
    this._validateCreateMessage(data, departmentId);

    return this.connection.withTransaction(async (client) => {
      // Look up sender user
      const senderResult = await client.query(
        'SELECT id, department_id FROM users WHERE id = $1',
        [data.senderId]
      );
      if (senderResult.rowCount === 0) {
        throw new NotFoundError('Sender not found');
      }
      const sender = senderResult.rows[0];
      if (sender.department_id !== departmentId && departmentId !== 'ALL') {
        throw new ForbiddenError('Sender is outside your department scope');
      }

      // Look up receiver user
      const receiverResult = await client.query(
        'SELECT id, department_id FROM users WHERE id = $1',
        [data.receiverId]
      );
      if (receiverResult.rowCount === 0) {
        throw new NotFoundError('Receiver not found');
      }
      const receiver = receiverResult.rows[0];
      if (receiver.department_id !== departmentId && departmentId !== 'ALL') {
        throw new ForbiddenError('Receiver is outside your department scope');
      }

      const message = await this.repository.create(
        {
          senderId: data.senderId,
          receiverId: data.receiverId,
          subject: data.subject || null,
          body: data.body,
        },
        client
      );

      return message;
    });
  }

  async updateMessage(id, data, userId, userRole, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Message not found');
    }
    
    const isParticipant = existing.sender_id === userId || existing.receiver_id === userId;
    if (!isParticipant && userRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Access denied: you are not a participant in this message');
    }
    
    if (data.senderId || data.receiverId) {
      throw new ForbiddenError('Cannot modify sender or receiver of a message');
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(id, data, client);
      if (!updated) {
        throw new NotFoundError('Message not found during update');
      }
      return updated;
    });
  }

  async deleteMessage(id, userId, userRole, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Message not found');
    }
    
    const isParticipant = existing.sender_id === userId || existing.receiver_id === userId;
    if (!isParticipant && userRole !== 'PRINCIPAL') {
      throw new ForbiddenError('Access denied: you are not a participant in this message');
    }

    return this.connection.withTransaction(async (client) => {
      const deleted = await this.repository.delete(id, client);
      if (!deleted) {
        throw new NotFoundError('Message not found during deletion');
      }
      return deleted;
    });
  }

  _validateCreateMessage(data, departmentId) {
    const errors = [];
    if (!data.senderId) errors.push({ field: 'senderId', message: 'Sender ID is required' });
    if (!data.receiverId) errors.push({ field: 'receiverId', message: 'Receiver ID is required' });
    if (data.senderId === data.receiverId) {
      errors.push({ field: 'senderId', message: 'Sender and receiver must be different users' });
    }
    if (!data.body || !data.body.trim()) {
      errors.push({ field: 'body', message: 'Message body is required' });
    }
    if (data.body && data.body.length > 5000) {
      errors.push({ field: 'body', message: 'Message body cannot exceed 5000 characters' });
    }

    if (errors.length > 0) {
      throw new BadRequestError('Validation failed', errors);
    }
  }
}

module.exports = MessageService;