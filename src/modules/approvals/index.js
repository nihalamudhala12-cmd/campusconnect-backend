/**
 * Approvals Module
 * M10 — Approvals API
 *
 * Provides approval workflow functionality for leave requests, marks revisions, syllabus updates, etc.
 * Integrates with existing approval tables from migrations.
 * Enforces RBAC: requesters submit, HODs/FACULTY/PRINCIPAL approve, PRINCIPAL can bypass.
 */

const approvalsRoutes = require('./approvals/routes');

module.exports = approvalsRoutes;
