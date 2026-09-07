/**
 * server/src/middleware/financialRateLimiter.js
 *
 * Targeted Rate Limiting for Financial Endpoints (Phase 5)
 *
 * Protects financial transaction endpoints against brute-force, replay attacks,
 * and high-frequency thrashing, while exempting Razorpay webhooks.
 *
 * Standard Response: HTTP 429 Too Many Requests with retry headers.
 */

const rateLimit = require('express-rate-limit');

/**
 * Standard 429 handler formatting clean JSON errors.
 */
function createRateLimitHandler(customMessage) {
  return (req, res) => {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: customMessage || 'Too many financial operations requested. Please retry shortly.',
      retryAfter: res.getHeader('Retry-After') || '15 minutes'
    });
  };
}

/**
 * Limiter for Payment Order Creation
 * Max 20 requests per 15 minutes per IP
 */
const paymentOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many payment orders initiated. Please wait 15 minutes before creating new orders.')
});

/**
 * Limiter for Payment Signature Verification
 * Max 30 requests per 15 minutes per IP
 */
const paymentVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many payment verification attempts. Please wait a few minutes.')
});

/**
 * Limiter for Booking Cancellation Requests
 * Max 10 cancellations per 15 minutes
 */
const bookingCancellationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many cancellation requests submitted. Please wait 15 minutes.')
});

/**
 * Limiter for Assistant Payout Requests & Cancellations
 * Max 10 requests per 15 minutes
 */
const payoutRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many payout operations. Please wait 15 minutes before submitting another request.')
});

/**
 * Limiter for Administrative Payout Operations (approve/process/paid/failed)
 * Max 60 requests per 15 minutes
 */
const adminPayoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Administrative payout request threshold reached. Please wait a few moments.')
});

module.exports = {
  paymentOrderLimiter,
  paymentVerifyLimiter,
  bookingCancellationLimiter,
  payoutRequestLimiter,
  adminPayoutLimiter
};
