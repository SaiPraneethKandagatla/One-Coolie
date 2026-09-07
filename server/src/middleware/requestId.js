/**
 * server/src/middleware/requestId.js
 *
 * Unique Request Correlation ID Middleware (Phase 6)
 *
 * Attaches a secure request identifier for distributed tracing and observability.
 * Exposes `req.requestId` and adds the `X-Request-ID` response header.
 */

const crypto = require('crypto');

const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];

  // Accept incoming valid request ID or generate a cryptographically random one
  let requestId;
  if (typeof incomingId === 'string' && VALID_REQUEST_ID_REGEX.test(incomingId.trim())) {
    requestId = incomingId.trim();
  } else {
    requestId = `req_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
  }

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

module.exports = requestIdMiddleware;
