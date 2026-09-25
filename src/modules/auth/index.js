const AuthRepository = require('./authRepository');
const AuthService = require('./authService');
const AuthController = require('./authController');
const authRoutes = require('./routes');

function createAuthModule(connection) {
  const authRepository = new AuthRepository(connection.getPool());
  const authService = new AuthService(authRepository, connection);
  const authController = new AuthController(authService);

  return {
    router: authRoutes,
    repository: authRepository,
    service: authService,
    controller: authController,
  };
}

module.exports = {
  createAuthModule,
  authRoutes,
  AuthRepository,
  AuthService,
  AuthController,
};
