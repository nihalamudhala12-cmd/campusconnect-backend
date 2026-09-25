with open(r'D:\backend\src\routes\index.js', 'w') as f:
    f.write("""/**
 * Route Registry
 * Step 6.1 — Backend Foundation
 */
const { Router } = require('express');

function routeIndex() {
  const router = Router();
  router.use('/api', require('../modules/sample/routes'));
  router.use('/api', require('../modules/users/routes'));
  router.use('/api', require('../modules/departments/routes'));
  return router;
}

module.exports = { routeIndex };
""")
