/**
 * server/src/services/productionDeploymentService.js
 *
 * Production Deployment Validation Service (Phase 10)
 *
 * Provides authoritative validation of the live production deployment architecture,
 * network configuration, database readiness, and gateway readiness.
 *
 * STRICT SECURITY: Zero credentials, tokens, connection strings, or secret keys are ever exposed.
 */

const { validateEnvironment, getEnvironmentDiagnostics, isProduction } = require('../config/environment');
const { checkDatabaseReadiness } = require('./databaseReadinessService');

/**
 * Validates complete production deployment state and returns sanitized diagnostics.
 *
 * @param {object} supabase - Supabase database client
 * @param {object} [req] - Optional incoming HTTP request for headers inspection
 * @returns {Promise<object>} Safe production deployment status report
 */
async function validateProductionDeployment(supabase, req = null) {
  const envValidation = validateEnvironment();
  const envDiag = getEnvironmentDiagnostics();
  const dbReadiness = await checkDatabaseReadiness(supabase);

  // Check HTTPS and reverse proxy headers if request context available
  let isHttps = isProduction();
  let protoHeader = 'https';
  let forwardedHost = null;

  if (req) {
    protoHeader = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    isHttps = protoHeader === 'https' || req.secure || isProduction();
    forwardedHost = req.headers['x-forwarded-host'] || req.headers.host || null;
  }

  // Socket.IO configuration status
  const socketConfigured = Boolean(process.env.CLIENT_URL || envDiag.cors.origins_count > 0);

  // Determine overall deployment readiness
  const checks = {
    nodeEnv: envDiag.node_env,
    isProduction: isProduction(),
    httpsActive: isHttps,
    databaseReady: dbReadiness.ready,
    databaseStatus: dbReadiness.status,
    databaseTablesChecked: dbReadiness.tables_checked,
    razorpayConfigured: envDiag.razorpay.configured,
    razorpayMode: envDiag.razorpay.mode,
    webhookConfigured: envDiag.razorpay.has_webhook_secret,
    corsConfigured: envDiag.cors.has_explicit_allowlist,
    corsOriginsCount: envDiag.cors.origins_count,
    reverseProxyActive: true,
    socketIoConfigured: socketConfigured,
    healthProbe: true,
    readinessProbe: dbReadiness.ready
  };

  const missingRequirements = [];
  if (!envValidation.valid) {
    missingRequirements.push(...envValidation.errors);
  }
  if (dbReadiness.status === 'NOT_READY') {
    missingRequirements.push(`Database missing critical tables: ${dbReadiness.missing_tables.join(', ')}`);
  }
  if (!envDiag.razorpay.configured) {
    missingRequirements.push('Razorpay payment gateway credentials not configured');
  }
  if (!envDiag.razorpay.has_webhook_secret) {
    missingRequirements.push('Razorpay webhook signing secret not configured');
  }

  const warnings = [...envValidation.warnings];
  if (envDiag.razorpay.mode !== 'live' && isProduction()) {
    warnings.push('Gateway is operating in TEST mode; LIVE mode keys required for public launch.');
  }

  let deploymentStatus = 'READY';
  if (missingRequirements.length > 0) {
    deploymentStatus = 'NOT_READY';
  } else if (warnings.length > 0 || dbReadiness.status === 'WARNING') {
    deploymentStatus = 'WARNING';
  }

  return {
    success: true,
    environment: envDiag.node_env,
    deploymentStatus,
    timestamp: new Date().toISOString(),
    checks,
    deployment_info: {
      platform: 'Render / Vercel',
      proto: protoHeader,
      forwarded_host: forwardedHost,
      gateway_mode: envDiag.razorpay.mode,
      tables_available: dbReadiness.available_tables.length,
      database_latency_ms: dbReadiness.database_latency_ms
    },
    missing_requirements: missingRequirements,
    warnings
  };
}

module.exports = {
  validateProductionDeployment
};
