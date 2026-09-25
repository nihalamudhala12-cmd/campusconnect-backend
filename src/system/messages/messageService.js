const { BaseService } = require('../../services');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../errors');
const { toMessageDto } = require('../../utils/dtoMapper');

class MessageService extends BaseService {
  async getMessage(id, departmentId) {
    const message = await this.repository.findById(id);
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    this._enforceDepartmentScope(message, departmentId);
    return message;
  }

  async getMessages(departmentId, options = {}) {
    return this.repository.findAll(departmentId, options);
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

  async updateMessage(id, data, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Message not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

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

  async deleteMessage(id, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Message not found');
    }

    this._enforceDepartmentScope(existing, departmentId);

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

  _enforceDepartmentScope(message, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (message.sender_id !== departmentId && message.receiver_id !== departmentId) {
      throw new ForbiddenError('Access denied: message is outside your department scope');
    }
  }

  _enforceDepartmentScopeForUser(user, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (user.department_id !== departmentId) {
      throw new ForbiddenError('Access denied: user is outside your department scope');
    }
  }

  _getUserDepartmentId(userId) {
    return userId ? userId.split('_')[1] : null;
  }
}

module.exports = MessageService;