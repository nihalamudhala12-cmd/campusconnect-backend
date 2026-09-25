const jwt = require('jsonwebtoken');
const config = require('../config');

const { UnauthorizedError } = require('../errors');

function generateToken(payload, expiresIn) {
  const secret = config.security.jwtSecret;
  if (!secret) {
    throw new UnauthorizedError('JWT secret is not configured');
  }
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: expiresIn || config.security.jwtExpiresIn || '1d',
  });
}

function verifyToken(token) {
  const secret = config.security.jwtSecret;
  if (!secret) {
    throw new UnauthorizedError('JWT secret is not configured');
  }
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('Token is required');
  }
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token has expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Invalid token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
}

module.exports = {
  generateToken,
  verifyToken,
};
