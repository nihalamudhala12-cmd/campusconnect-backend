const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { UnauthorizedError, NotFoundError, ConflictError } = require('../../errors');
const { verifyPassword } = require('../../utils/passwordHash');
const { generateToken, verifyToken } = require('../../utils/jwt');

const pendingAuths = new Map();

class AuthService {
  constructor(userRepository, connection) {
    this.userRepository = userRepository;
    this.connection = connection;
  }

  async authenticate(email, password) {
    if (!email || !password) {
      throw new UnauthorizedError('Email and password are required');
    }

    const user = await this.userRepository.findByIdentifier(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.password_hash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status === 'INACTIVE') {
      throw new UnauthorizedError('Account is deactivated');
    }

    return { user };
  }

  async refreshToken(token) {
    const decoded = verifyToken(token);
    const userId = decoded.id || decoded.sub;
    if (!userId || !decoded.role) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    return {
      token: generateToken(
        {
          id: userId,
          role: decoded.role,
          departmentId: decoded.departmentId,
          email: decoded.email,
        },
        undefined
      ),
    };
  }

  isMfaRequired(user) {
    return user.mfa_enabled === true;
  }

  async createPendingAuth(userId) {
    cleanupPendingAuths();
    const challengeToken = crypto.randomUUID();
    const code = crypto.randomInt(1000, 10000).toString();
    const codeHash = await bcrypt.hash(code, 12);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    pendingAuths.set(challengeToken, {
      userId,
      codeHash,
      expiresAt,
      attempts: 0,
      maxAttempts: 5,
      used: false,
      createdAt: new Date(),
    });

    return { challengeToken, code };
  }

  getPendingAuth(challengeToken) {
    cleanupPendingAuths();
    return pendingAuths.get(challengeToken);
  }

  verifyPendingAuth(challengeToken) {
    cleanupPendingAuths();
    if (!challengeToken) {
      throw new UnauthorizedError('MFA challenge required');
    }

    const pending = pendingAuths.get(challengeToken);
    if (!pending) {
      throw new UnauthorizedError('Invalid or expired MFA challenge');
    }

    if (pending.used) {
      pendingAuths.delete(challengeToken);
      throw new UnauthorizedError('MFA challenge already used');
    }

    if (new Date() > pending.expiresAt) {
      pendingAuths.delete(challengeToken);
      throw new UnauthorizedError('MFA challenge has expired');
    }

    if (pending.attempts >= pending.maxAttempts) {
      pendingAuths.delete(challengeToken);
      throw new UnauthorizedError('MFA challenge has exceeded maximum attempts');
    }

    return pending;
  }

  async verifyMfaCode(challengeToken, code) {
    const pending = this.verifyPendingAuth(challengeToken);

    pending.attempts += 1;

    const isValid = await verifyPassword(code, pending.codeHash);

    if (!isValid) {
      if (pending.attempts >= pending.maxAttempts) {
        pendingAuths.delete(challengeToken);
        throw new UnauthorizedError('Invalid MFA code. Maximum attempts reached.');
      }
      throw new UnauthorizedError('Invalid MFA code');
    }

    const user = await this.userRepository.findById(pending.userId);
    if (!user) {
      pendingAuths.delete(challengeToken);
      throw new UnauthorizedError('User not found');
    }

    if (user.status === 'INACTIVE') {
      pendingAuths.delete(challengeToken);
      throw new UnauthorizedError('Account is deactivated');
    }

    pendingAuths.delete(challengeToken);

    return { user };
  }

  async getSessionUser(userId) {
    if (!userId) {
      throw new UnauthorizedError('User ID is required for session validation');
    }
    const existing = await this.userRepository.findById(userId);
    return existing;
  }
}

function cleanupPendingAuths() {
  const now = Date.now();
  for (const [challengeToken, pending] of pendingAuths.entries()) {
    if (pending.expiresAt.getTime() <= now) {
      pendingAuths.delete(challengeToken);
    }
  }
}

module.exports = AuthService;
module.exports.pendingAuths = pendingAuths;
