/**
 * server/src/utils/logger.js
 *
 * Structured Logging & Observability Utility (Phase 6)
 *
 * Emits JSON-formatted operational and financial telemetry.
 *
 * STRICT SECURITY:
 * Automatically sanitizes and scrubs:
 * - JWT tokens
 * - Passwords
 * - Razorpay secrets & signatures
 * - Supabase service role keys
 * - Authorization headers
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'authorization',
  'razorpay_key_secret',
  'razorpay_webhook_secret',
  'supabase_secret_key',
  'key_secret',
  'signature',
  'razorpay_signature'
]);

/**
 * Recursively scrubs sensitive values from log objects.
 * Replaces secrets with boolean or masked markers.
 *
 * @param {*} data
 * @param {number} [depth=0]
 * @returns {*}
 */
function sanitize(data, depth = 0) {
  if (depth > 5 || data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if key matches sensitive patterns
    const isSensitive =
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('authorization');

    if (isSensitive) {
      if (lowerKey.includes('signature')) {
        sanitized[key] = Boolean(value) ? '[SIGNATURE_PRESENT]' : '[EMPTY]';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object') {
      sanitized[key] = sanitize(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Base output format.
 */
function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...sanitize(meta)
  };

  // In production or structured logging environments, write standard JSON
  const output = JSON.stringify(entry);
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

const logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),

  /**
   * Log safe financial operational event.
   *
   * @param {string} eventName
   * @param {object} eventData
   */
  financial: (eventName, eventData = {}) => {
    log('info', `[FINANCIAL_EVENT] ${eventName}`, {
      financial_event: eventName,
      ...eventData
    });
  },

  sanitize
};

/**
 * Express middleware for request logging with duration and request correlation ID.
 */
function requestLoggerMiddleware(req, res, next) {
  const start = Date.now();

  // Log on response completion
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;

    const meta = {
      request_id: req.requestId || req.headers['x-request-id'] || 'no-req-id',
      method: req.method,
      route: req.originalUrl || req.url,
      status: statusCode,
      duration_ms: durationMs,
      ip: req.ip || req.socket.remoteAddress
    };

    if (isError) {
      log(statusCode >= 500 ? 'error' : 'warn', `HTTP ${req.method} ${meta.route} ${statusCode}`, meta);
    } else {
      log('info', `HTTP ${req.method} ${meta.route} ${statusCode}`, meta);
    }
  });

  next();
}

module.exports = {
  logger,
  requestLoggerMiddleware,
  sanitize
};
