const crypto = require('crypto');
const BaseService = require('../../services/baseService');
const { BadRequestError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class SessionService extends BaseService {
  constructor(sessionRepository, connection) {
    super(sessionRepository);
    this.connection = connection;
  }

  async getSessions(userId, options = {}, userRole) {
    if (userRole === 'PRINCIPAL') {
      return this.repository.findAll(options);
    }
    return this.repository.findByUserId(userId, options);
  }

  async getSession(id, userId, userRole, departmentId) {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new NotFoundError('Session not found');
    }
    this._enforceDepartmentScope(session, userRole, departmentId);
    if (userRole !== 'PRINCIPAL' && session.user_id !== userId) {
      throw new ForbiddenError('Cannot access session for another user');
    }
    return session;
  }

  async createSession(data, requesterUserId, requesterRole, requesterDeptId) {
    const errors = [];
    
    if (!data.token) errors.push({ field: 'token', message: 'Session token is required' });
    if (!data.userId) errors.push({ field: 'userId', message: 'User ID is required' });
    if (!data.deviceFingerprint) errors.push({ field: 'deviceFingerprint', message: 'Device fingerprint is required' });
    if (!data.ipAddress) errors.push({ field: 'ipAddress', message: 'IP address is required' });
    if (!data.userAgent) errors.push({ field: 'userAgent', message: 'User agent is required' });
    
    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    if (requesterRole !== 'PRINCIPAL' && data.userId !== requesterUserId) {
      throw new ForbiddenError('Cannot create session for another user');
    }

    const hashedToken = hashToken(data.token);

    return this.connection.withTransaction(async (client) => {
      const session = await this.repository.create(
        {
          userId: data.userId,
          token: hashedToken,
          deviceFingerprint: data.deviceFingerprint,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          isActive: data.isActive || true,
          expiresAt: data.expiresAt || null,
          departmentId: data.departmentId || requesterDeptId,
          locationInfo: data.locationInfo || null,
        },
        client
      );
      return session;
    });
  }

  async updateSession(id, data, userId, userRole, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Session not found');
    }

    this._enforceDepartmentScope(existing, userRole, departmentId);

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot update session for another user');
    }

    return this.connection.withTransaction(async (client) => {
      const updated = await this.repository.update(id, data, client);
      if (!updated) {
        throw new NotFoundError('Session not found during update');
      }
      return updated;
    });
  }

  async revokeSession(id, userId, userRole, departmentId) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Session not found');
    }

    this._enforceDepartmentScope(existing, userRole, departmentId);

    if (userRole !== 'PRINCIPAL' && existing.user_id !== userId) {
      throw new ForbiddenError('Cannot revoke session for another user');
    }

    return this.connection.withTransaction(async (client) => {
      const revoked = await this.repository.revoke(id, client);
      if (!revoked) {
        throw new NotFoundError('Session not found during revocation');
      }
      return revoked;
    });
  }

  async getUserDevices(userId, requesterUserId, requesterRole, requesterDeptId) {
    if (requesterRole !== 'PRINCIPAL' && userId !== requesterUserId) {
      throw new ForbiddenError('Cannot access devices for another user');
    }

    return this.repository.findDevicesByUserId(userId, {});
  }

  _enforceDepartmentScope(session, userRole, departmentId) {
    if (departmentId === 'ALL') {
      return;
    }
    if (session.department_id === departmentId || !session.department_id) {
      return;
    }
    throw new ForbiddenError('Session is outside your department scope');
  }
}

module.exports = SessionService;
