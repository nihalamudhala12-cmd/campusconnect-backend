const { BadRequestError } = require('../../errors');

function validateLogin(body) {
  const errors = [];

  if (!body || !body.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push({ field: 'email', message: 'Email format is invalid' });
  }

  if (!body || !body.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (typeof body.password !== 'string' || body.password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  return errors;
}

function validateMfaVerify(body) {
  const errors = [];

  if (!body || !body.code) {
    errors.push({ field: 'code', message: 'MFA code is required' });
  } else if (typeof body.code !== 'string' || !/^\d{4}$/.test(body.code)) {
    errors.push({ field: 'code', message: 'MFA code must be a 4-digit number' });
  }

  if (!body || !body.mfaChallenge) {
    errors.push({ field: 'mfaChallenge', message: 'MFA challenge is required' });
  } else if (typeof body.mfaChallenge !== 'string' || body.mfaChallenge.length === 0) {
    errors.push({ field: 'mfaChallenge', message: 'MFA challenge is invalid' });
  }

  return errors;
}

module.exports = {
  validateLogin,
  validateMfaVerify,
};
