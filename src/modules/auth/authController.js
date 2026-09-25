const BaseController = require('../../controllers/baseController');
const { BadRequestError, UnauthorizedError } = require('../../errors');
const { toUserDto } = require('../../utils/dtoMapper');
const { hashPassword, verifyPassword } = require('../../utils/passwordHash');
const { generateToken } = require('../../utils/jwt');

class AuthController extends BaseController {
  constructor(authService) {
    super(authService);
    this.authService = authService;
  }

  async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const result = await this.authService.authenticate(email, password);
    const user = result.user;

    if (this.authService.isMfaRequired(user)) {
      const { challengeToken, code } = await this.authService.createPendingAuth(user.id);
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[MFA_DEBUG] code=' + code + ' for user=' + user.email + ' challenge=' + challengeToken);
      }
      return res.status(200).json({
        success: true,
        message: 'MFA verification required',
        data: {
          mfaRequired: true,
          mfaChallenge: challengeToken,
          user: toUserDto(user),
          ...(process.env.NODE_ENV !== 'production' && { _debugCode: code }),
        },
      });
    }

    const token = generateToken(
      { id: user.id, role: user.role, departmentId: user.department_id, email: user.email },
      undefined
    );

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        user: toUserDto(user),
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
      },
    });
  }

  async mfaVerify(req, res) {
    const { code, mfaChallenge } = req.body;

    if (!code || !mfaChallenge) {
      throw new BadRequestError('MFA code and challenge are required');
    }

    const result = await this.authService.verifyMfaCode(mfaChallenge, code);
    const user = result.user;

    const token = generateToken(
      { id: user.id, role: user.role, departmentId: user.department_id, email: user.email },
      undefined
    );

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        user: toUserDto(user),
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
      },
    });
  }

  async me(req, res) {
    const user = await this.authService.getSessionUser(req.user.id);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Session is no longer valid');
    }
    return this.ok(res, toUserDto(user), 'Session validated');
  }

  async refreshToken(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }
    const result = await this.authService.refreshToken(refreshToken);
    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: result,
    });
  }
}

module.exports = AuthController;
