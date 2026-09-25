// System Configuration Module Index
// M14 — System Configuration API
//
// Registers the system configuration module router for registration in the main route registry.
// Manages institution-wide system configuration and environment settings.
// Subject to strict authorization controls (PRINCIPAL role only).

const systemConfigRoutes = require('./routes');

module.exports = systemConfigRoutes;
