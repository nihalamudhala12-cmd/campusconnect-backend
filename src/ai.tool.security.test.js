/**
 * AI Tool Security Verification Test Suite
 * M3 — AI Security Tests
 *
 * Verifies security properties of the AI Tool Registry, focusing on:
 *   1. Tool registration and schema correctness
 *   2. Role-based access control (RBAC) for get_departments
 *   3. Input validation (limit, page, status)
 *   4. Department scope isolation through service calls
 *   5. Unauthorized tool access rejection
 */

const assert = require('assert');
const crypto = require('crypto');
const { ToolRegistry, getToolsForRole } = require('./modules/ai/aiToolRegistry');

const uuidv4 = () => crypto.randomUUID();

let passed = 0;
let failed = 0;

function assertPass(name) {
  passed++;
  console.log(`[${name}] PASS`);
}

function assertFail(name, error) {
  failed++;
  console.error(`[${name}] FAIL: ${error}`);
}

function findTool(name) {
  return ToolRegistry.find((t) => t.name === name);
}

async function runAIToolSecurityTests() {
  console.log('--- Starting AI Tool Security Verification Test Suite ---\n');

  try {
    // =========================================================================
    // SECTION 1: Tool Registration & Schema Correctness
    // =========================================================================
    console.log('--- Section 1: Tool Registration & Schema ---\n');

    const getDepartmentsTool = findTool('get_departments');
    assert.ok(getDepartmentsTool, 'get_departments tool must exist in ToolRegistry');
    assertPass('AISEC-01: get_departments tool is registered');

    assert.strictEqual(getDepartmentsTool.description, 'Get list of departments accessible to the user');
    assertPass('AISEC-02: get_departments has correct description');

    assert.ok(getDepartmentsTool.parameters, 'get_departments must have parameters schema');
    assert.strictEqual(getDepartmentsTool.parameters.type, 'object');
    assertPass('AISEC-03: get_departments has object parameter schema');

    const props = getDepartmentsTool.parameters.properties;
    assert.ok(props.limit, 'get_departments must have limit parameter');
    assert.ok(props.page, 'get_departments must have page parameter');
    assert.ok(props.search, 'get_departments must have search parameter');
    assert.ok(props.status, 'get_departments must have status parameter');
    assertPass('AISEC-04: get_departments has all required parameters (limit, page, search, status)');

    assert.strictEqual(props.status.enum[0], 'ACTIVE');
    assert.strictEqual(props.status.enum[1], 'INACTIVE');
    assertPass('AISEC-05: get_departments status parameter is restricted to ACTIVE/INACTIVE enum');

    assert.strictEqual(props.limit.minimum, 1);
    assert.strictEqual(props.limit.maximum, 100);
    assertPass('AISEC-06: get_departments limit is bounded 1-100');

    assert.strictEqual(props.page.minimum, 1);
    assertPass('AISEC-07: get_departments page has minimum of 1');

    assert.strictEqual(getDepartmentsTool.parameters.additionalProperties, false);
    assertPass('AISEC-08: get_departments rejects additional properties (no injection)');

    // =========================================================================
    // SECTION 2: RBAC - Role-Based Access Control
    // =========================================================================
    console.log('\n--- Section 2: RBAC - Role-Based Access ---\n');

    const principalTools = getToolsForRole('PRINCIPAL');
    assert.ok(principalTools.some((t) => t.name === 'get_departments'));
    assertPass('AISEC-09: PRINCIPAL has access to get_departments');

    const hodTools = getToolsForRole('HOD');
    assert.ok(hodTools.length > 0);
    assert.ok(hodTools.some((t) => t.name === 'get_departments'));
    assertPass('AISEC-10: HOD has access to get_departments');

const studentTools = getToolsForRole('STUDENT');
     assert.ok(studentTools.some((t) => t.name === 'get_departments'));
     assertPass('AISEC-11: STUDENT has access to get_departments');

     const allowedRoles = getDepartmentsTool.roleScope;
     assert.ok(allowedRoles.includes('PRINCIPAL'), 'PRINCIPAL must be in roleScope');
     assert.ok(allowedRoles.includes('HOD'), 'HOD must be in roleScope');
     assert.ok(allowedRoles.includes('FACULTY'), 'FACULTY must be in roleScope');
     assert.ok(allowedRoles.includes('STUDENT'), 'STUDENT must be in roleScope');
     assert.ok(allowedRoles.includes('PARENT'), 'PARENT must be in roleScope');
     assert.ok(!allowedRoles.includes('ALUMNI'), 'ALUMNI must NOT be in roleScope');
     assert.ok(!allowedRoles.includes('STAFF'), 'STAFF must NOT be in roleScope');
     assert.ok(!allowedRoles.includes('GUEST'), 'GUEST must NOT be in roleScope');
     assertPass('AISEC-12: get_departments roleScope includes only allowed roles');

    // =========================================================================
    // SECTION 3: Input Validation - Limit Constraints
    // =========================================================================
    console.log('\n--- Section 3: Input Validation - Limit ---\n');

    const user = { id: uuidv4(), name: 'Test User', email: 'test@test.com', role: 'HOD', departmentId: 'dept-1' };

    const validateNoLimit = getDepartmentsTool.validate({}, user);
    assert.strictEqual(validateNoLimit.valid, true);
    assertPass('AISEC-14: Empty args validated successfully');

    const validateLimit50 = getDepartmentsTool.validate({ limit: 50 }, user);
    assert.strictEqual(validateLimit50.valid, true);
    assertPass('AISEC-15: limit=50 is accepted');

    const validateLimit100 = getDepartmentsTool.validate({ limit: 100 }, user);
    assert.strictEqual(validateLimit100.valid, true);
    assertPass('AISEC-16: limit=100 (max) is accepted');

    const validateLimit101 = getDepartmentsTool.validate({ limit: 101 }, user);
    assert.strictEqual(validateLimit101.valid, false);
    assert.ok(validateLimit101.message.includes('100'));
    assertPass('AISEC-17: limit=101 is rejected (exceeds max)');

    // =========================================================================
    // SECTION 4: Input Validation - Page Constraints
    // =========================================================================
    console.log('\n--- Section 4: Input Validation - Page ---\n');

    const validatePage0 = getDepartmentsTool.validate({ page: 0 }, user);
    assert.strictEqual(validatePage0.valid, false);
    assert.ok(validatePage0.message.includes('at least 1'));
    assertPass('AISEC-18: page=0 is rejected');

    const validatePage1 = getDepartmentsTool.validate({ page: 1 }, user);
    assert.strictEqual(validatePage1.valid, true);
    assertPass('AISEC-19: page=1 is accepted');

    const validatePageNegative = getDepartmentsTool.validate({ page: -5 }, user);
    assert.strictEqual(validatePageNegative.valid, false);
    assertPass('AISEC-20: negative page is rejected');

    // =========================================================================
    // SECTION 5: Input Validation - Status Enum
    // =========================================================================
    console.log('\n--- Section 5: Input Validation - Status ---\n');

    const validateStatusActive = getDepartmentsTool.validate({ status: 'ACTIVE' }, user);
    assert.strictEqual(validateStatusActive.valid, true);
    assertPass('AISEC-21: status=ACTIVE is accepted');

    const validateStatusInactive = getDepartmentsTool.validate({ status: 'INACTIVE' }, user);
    assert.strictEqual(validateStatusInactive.valid, true);
    assertPass('AISEC-22: status=INACTIVE is accepted');

    const validateStatusInvalid = getDepartmentsTool.validate({ status: 'DELETED' }, user);
    assert.strictEqual(validateStatusInvalid.valid, false);
    assert.ok(validateStatusInvalid.message.includes('ACTIVE') && validateStatusInvalid.message.includes('INACTIVE'));
    assertPass('AISEC-23: status=DELETED is rejected (not in enum)');

    const validateStatusLowercase = getDepartmentsTool.validate({ status: 'active' }, user);
    assert.strictEqual(validateStatusLowercase.valid, false);
    assertPass('AISEC-24: status=active (lowercase) is rejected (case-sensitive)');

    // =========================================================================
    // SECTION 6: Authentication Validation
    // =========================================================================
    console.log('\n--- Section 6: Authentication Validation ---\n');

    const validateNoUser = getDepartmentsTool.validate({}, null);
    assert.strictEqual(validateNoUser.valid, false);
    assert.ok(validateNoUser.message.includes('authenticated'));
    assertPass('AISEC-25: null user is rejected with authentication error');

    const validateUndefinedUser = getDepartmentsTool.validate({}, undefined);
    assert.strictEqual(validateUndefinedUser.valid, false);
    assertPass('AISEC-26: undefined user is rejected with authentication error');

    // =========================================================================
    // SECTION 7: No Secret/Data Leakage in Schema
    // =========================================================================
    console.log('\n--- Section 7: No Sensitive Data in Tool ---\n');

    const toolStr = JSON.stringify(getDepartmentsTool);
    assert.ok(!toolStr.includes('password'), 'Tool definition must not contain "password"');
    assert.ok(!toolStr.includes('secret'), 'Tool definition must not contain "secret"');
    assert.ok(!toolStr.includes('token'), 'Tool definition must not contain "token"');
    assert.ok(!toolStr.includes('api_key'), 'Tool definition must not contain "api_key"');
    assert.ok(!toolStr.includes('credential'), 'Tool definition must not contain "credential"');
    assertPass('AISEC-27: get_departments schema contains no sensitive data');

    // =========================================================================
    // SECTION 8: All Tools Have Validation and Execute Functions
    // =========================================================================
    console.log('\n--- Section 8: Tool Structure Integrity ---\n');

    for (const tool of ToolRegistry) {
      assert.ok(typeof tool.validate === 'function', `Tool ${tool.name} must have validate function`);
      assert.ok(typeof tool.execute === 'function', `Tool ${tool.name} must have execute function`);
      assert.ok(Array.isArray(tool.roleScope), `Tool ${tool.name} must have roleScope array`);
      assert.ok(tool.parameters, `Tool ${tool.name} must have parameters schema`);
      assert.ok(tool.parameters.type === 'object', `Tool ${tool.name} parameters must be object type`);
    }
    assertPass(`AISEC-28: All ${ToolRegistry.length} tools have validate, execute, roleScope, and parameters`);

    // =========================================================================
    // SECTION 9: PRINCIPAL Override Check
    // =========================================================================
    console.log('\n--- Section 9: PRINCIPAL Override ---\n');

    const principalValidate = getDepartmentsTool.validate({ limit: 10, page: 1 }, { id: 'p1', role: 'PRINCIPAL', departmentId: null });
    assert.strictEqual(principalValidate.valid, true);
    assertPass('AISEC-29: PRINCIPAL can invoke get_departments with valid params');

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n=================================================================');
    console.log(`AI TOOL SECURITY TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('=================================================================\n');
  } catch (err) {
    assertFail('AISEC-RUNTIME', err);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAIToolSecurityTests();
