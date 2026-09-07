/**
 * server/src/middleware/errorHandler.js
 *
 * Centralized Global Error Handling Middleware (Phase 6)
 *
 * Protects against internal error and credential leakage in production.
 * In production: outputs generic, sanitized error messages with correlation request ID.
 * In development: includes descriptive context for developer velocity.
 */

const { isProduction } = require('../config/environment');
const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const prod = isProduction();
  const requestId = req.requestId || req.headers?.['x-request-id'] || 'no-req-id';
  const statusCode = err.status || err.statusCode || 500;

  // Structured logging of unhandled server exception
  logger.error(`[UNHANDLED_EXCEPTION] ${err.message || 'Unknown server error'}`, {
    request_id: requestId,
    method: req.method,
    route: req.originalUrl,
    status: statusCode,
    stack: prod ? '[REDACTED_IN_PRODUCTION]' : err.stack
  });

  // Client response payload for production 500
  if (prod && statusCode >= 500) {
    return res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred.',
      requestId: requestId,
      request_id: requestId
    });
  }

  // Safe client error (e.g. 400, 403, 404, 409, 429) or development 500
  const message =
    err.isOperational || statusCode < 500
      ? err.message || 'Bad Request'
      : prod
      ? 'An unexpected server error occurred.'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    requestId: requestId,
    request_id: requestId,
    ...(prod ? {} : { stack: err.stack })
  });
}

module.exports = errorHandler;
