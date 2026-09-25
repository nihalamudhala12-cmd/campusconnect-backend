/**
 * Database Integration Hardening Automated Test Suite
 * Step 6.6 — DB-AUD-03, DB-AUD-10, DB-AUD-07 Verification
 *
 * Verifies:
 *   1. DB-AUD-03: DTO / ID translation & format validation (HTTP 400 for bad IDs)
 *   2. DB-AUD-10: Repository transaction support (BEGIN...COMMIT / ROLLBACK & BaseRepository.getRunner)
 *   3. DB-AUD-07: Department isolation query builder (Direct & derived department scoping + PRINCIPAL 'ALL')
 */

const assert = require('assert');
const connection = require('./infrastructure/database/connection');
const { BaseRepository } = require('./repositories');
const { parseIdOrCode, validateUUID, validateCode } = require('./utils/idMapper');
const {
  toUserDto,
  toDepartmentDto,
  toClassDto,
  toCourseDto,
  toAttendanceDto,
  toResultDto,
  toAnnouncementDto,
  toResponseEnvelope,
} = require('./utils/dtoMapper');
const { applyDepartmentScope } = require('./repositories/departmentScope');
const { BadRequestError, ForbiddenError } = require('./errors');

async function runHardeningTests() {
  console.log('--- Starting Database Integration Hardening Test Suite ---');

  try {
    // =========================================================================
    // SECTION 1: DB-AUD-03 — DTO / ID Translation Tests
    // =========================================================================
    console.log('\n[DB-AUD-03] Testing DTO & ID Translation Layer...');
    {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const validCode = 'CSE';
      const invalidId = 'invalid@id#$%^&*()';

      // 1. Valid UUID parsing
      assert.strictEqual(validateUUID(validUuid), true);
      const parsedUuid = parseIdOrCode(validUuid, 'Department');
      assert.strictEqual(parsedUuid.type, 'UUID');
      assert.strictEqual(parsedUuid.value, validUuid);
      console.log('  ✓ Valid UUID parsed correctly as type UUID');

      // 2. Valid Code parsing
      assert.strictEqual(validateCode(validCode), true);
      const parsedCode = parseIdOrCode(validCode, 'Department');
      assert.strictEqual(parsedCode.type, 'CODE');
      assert.strictEqual(parsedCode.value, validCode);
      console.log('  ✓ Valid business code (CSE) parsed correctly as type CODE');

      // 3. Malformed ID parsing -> throws BadRequestError (400)
      assert.throws(
        () => parseIdOrCode(invalidId, 'User'),
        (err) => err instanceof BadRequestError && err.statusCode === 400 && err.message.includes('Invalid User format')
      );
      console.log('  ✓ Malformed identifier raises HTTP 400 BadRequestError cleanly');

      // 4. DTO Mapping Verification
      const mockUserRow = {
        id: validUuid,
        name: 'Dr. Jane Smith',
        email: 'jane@uni.edu',
        role: 'HOD',
        department_id: 'dept_uuid_1',
        status: 'ACTIVE',
        created_at: new Date(),
      };
      const userDto = toUserDto(mockUserRow);
      assert.strictEqual(userDto.id, validUuid);
      assert.strictEqual(userDto.departmentId, 'dept_uuid_1');
      assert.strictEqual(userDto.role, 'HOD');

      const mockDeptRow = {
        id: 'dept_uuid_1',
        name: 'Computer Science',
        code: 'CSE',
        status: 'ACTIVE',
        created_at: new Date(),
      };
      const deptDto = toDepartmentDto(mockDeptRow);
      assert.strictEqual(deptDto.code, 'CSE');
      assert.strictEqual(deptDto.name, 'Computer Science');

      const envelope = toResponseEnvelope(deptDto, 'Department details');
      assert.strictEqual(envelope.success, true);
      assert.strictEqual(envelope.message, 'Department details');
      assert.strictEqual(envelope.data.code, 'CSE');

      console.log('  ✓ DTO mappers convert raw database rows into standardized camelCase API envelopes');
    }

    // =========================================================================
    // SECTION 2: DB-AUD-10 — Repository Transaction Support Tests
    // =========================================================================
    console.log('\n[DB-AUD-10] Testing Repository Transaction Support...');
    {
      // Initialize live PostgreSQL connection pool
      await connection.initialize();
      await connection.verifyConnection();

      // Concrete test repository extending BaseRepository
      class ConcreteTestRepo extends BaseRepository {
        async countDepartments(client = null) {
          const runner = this.getRunner(client);
          const res = await runner.query('SELECT COUNT(*)::int as count FROM departments');
          return res.rows[0].count;
        }
      }

      const repo = new ConcreteTestRepo(connection.getPool());

      // 1. Non-transaction invocation (backwards compatible)
      const countNonTx = await repo.countDepartments();
      assert.strictEqual(typeof countNonTx, 'number');
      console.log('  ✓ Existing non-transaction repository calls continue working normally');

      // 2. Transaction Commit Test (withTransaction)
      let tempDeptId = null;
      await connection.withTransaction(async (client) => {
        const runner = repo.getRunner(client);
        const res = await runner.query(
          "INSERT INTO departments (id, name, code, status) VALUES (gen_random_uuid(), 'Temp Dept Tx', 'TX_TEST_1', 'ACTIVE') RETURNING id"
        );
        tempDeptId = res.rows[0].id;
        const countInsideTx = await repo.countDepartments(client);
        assert.ok(countInsideTx > countNonTx);
      });

      // Verify commit persisted
      const countAfterCommit = await repo.countDepartments();
      assert.strictEqual(countAfterCommit, countNonTx + 1);

      // Cleanup committed record
      const pool = connection.getPool();
      await pool.query('DELETE FROM departments WHERE id = $1', [tempDeptId]);
      console.log('  ✓ Multi-operation transaction commits successfully and persists data');

      // 3. Transaction Rollback Test
      try {
        await connection.withTransaction(async (client) => {
          const runner = repo.getRunner(client);
          await runner.query(
            "INSERT INTO departments (id, name, code, status) VALUES (gen_random_uuid(), 'Temp Dept Fail', 'TX_FAIL_1', 'ACTIVE')"
          );
          throw new Error('Simulated workflow failure inside transaction');
        });
      } catch (err) {
        assert.strictEqual(err.message, 'Simulated workflow failure inside transaction');
      }

      // Verify rollback occurred (count unchanged)
      const countAfterRollback = await repo.countDepartments();
      assert.strictEqual(countAfterRollback, countNonTx);
      console.log('  ✓ Failed transaction automatically rolls back without leaving partial data');
    }

    // =========================================================================
    // SECTION 3: DB-AUD-07 — Department-Scoped Data Access Tests
    // =========================================================================
    console.log('\n[DB-AUD-07] Testing Department-Scoped Data Access...');
    {
      const deptId = '123e4567-e89b-12d3-a456-426614174000';

      // 1. Direct Department Table (users)
      const params1 = [];
      const scope1 = applyDepartmentScope('users', deptId, params1, 'u');
      assert.strictEqual(scope1.clause, 'u.department_id = $1');
      assert.strictEqual(params1[0], deptId);
      assert.strictEqual(scope1.join, '');
      console.log('  ✓ Direct department table (users) generates u.department_id = $1 clause');

      // 2. Derived Department Table (student_profiles)
      const params2 = [];
      const scope2 = applyDepartmentScope('student_profiles', deptId, params2, 'sp');
      assert.strictEqual(scope2.clause, 'users_dept.department_id = $1');
      assert.ok(scope2.join.includes('JOIN users users_dept ON sp.user_id = users_dept.id'));
      console.log('  ✓ Derived department table (student_profiles) generates correct JOIN to users.department_id');

      // 3. Derived Department Table (attendance)
      const params3 = [];
      const scope3 = applyDepartmentScope('attendance', deptId, params3, 'att');
      assert.strictEqual(scope3.clause, 'classes_dept.department_id = $1');
      assert.ok(scope3.join.includes('JOIN classes classes_dept ON att.class_id = classes_dept.id'));
      console.log('  ✓ Derived department table (attendance) generates correct JOIN to classes.department_id');

      // 4. PRINCIPAL Institution-Wide Scope ('ALL')
      const params4 = [];
      const scope4 = applyDepartmentScope('users', 'ALL', params4, 'u');
      assert.strictEqual(scope4.clause, '1=1');
      assert.strictEqual(params4.length, 0);
      console.log('  ✓ PRINCIPAL institution-wide scope ("ALL") returns un-restricted clause (1=1)');

      // 5. Unauthenticated / Missing Department ID -> Fail-Closed (ForbiddenError)
      assert.throws(
        () => applyDepartmentScope('users', null, []),
        (err) => err instanceof ForbiddenError && err.statusCode === 403
      );
      console.log('  ✓ Missing department context for non-PRINCIPAL query fails closed with HTTP 403 ForbiddenError');
    }

    console.log('\n=================================================================');
    console.log('ALL HARDENING TEST SUITES PASSED SUCCESSFULLY! (3/3 SECTIONS)');
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n❌ Hardening test failure:', err);
    process.exitCode = 1;
  } finally {
    await connection.close(1000).catch(() => {});
  }
}

if (require.main === module) {
  runHardeningTests();
}

module.exports = runHardeningTests;
