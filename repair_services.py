with open(r'D:\backend\src\services\index.js', 'w') as f:
    f.write("""/**
 * Service Registry
 * Step 6.1 — Backend Foundation
 */
const BaseService = require('./baseService');

module.exports = {
  BaseService,
  UserService: require('../modules/users/userService'),
  DepartmentService: require('../modules/departments/departmentService'),
};
""")
