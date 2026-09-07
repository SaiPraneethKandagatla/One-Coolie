/**
 * server/src/config/razorpay.js
 *
 * Centralized Razorpay Gateway Configuration for ONECOOLIE (Phase 2A)
 *
 * Features:
 * - Singleton Razorpay client initialization
 * - Safe credential validation (no server crash if missing in dev)
 * - Strict isolation: RAZORPAY_KEY_SECRET is NEVER returned to client
 * - Precise rupees-to-paise conversion (avoiding float inaccuracies)
 */

const Razorpay = require('razorpay');

let razorpayInstance = null;
let cachedKeyId = null;
let cachedKeySecret = null;

function getCleanKey(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Checks if Razorpay credentials are fully configured in the environment.
 * @returns {boolean}
 */
function isRazorpayConfigured() {
  const keyId = getCleanKey(process.env.RAZORPAY_KEY_ID);
  const keySecret = getCleanKey(process.env.RAZORPAY_KEY_SECRET);
  return Boolean(
    keyId &&
    keySecret &&
    keyId.length >= 8 &&
    keySecret.length >= 8 &&
    !keyId.includes('your-razorpay') &&
    !keyId.includes('xxxx')
  );
}

/**
 * Returns the singleton Razorpay instance.
 * Throws a clean error if credentials are not configured.
 * @returns {Razorpay}
 */
function getRazorpayClient() {
  const cleanKeyId = getCleanKey(process.env.RAZORPAY_KEY_ID);
  const cleanKeySecret = getCleanKey(process.env.RAZORPAY_KEY_SECRET);

  if (!isRazorpayConfigured()) {
    throw new Error(
      'Razorpay credentials are not configured or invalid. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
    );
  }

  if (razorpayInstance && cachedKeyId === cleanKeyId && cachedKeySecret === cleanKeySecret) {
    return razorpayInstance;
  }

  razorpayInstance = new Razorpay({
    key_id: cleanKeyId,
    key_secret: cleanKeySecret,
  });

  cachedKeyId = cleanKeyId;
  cachedKeySecret = cleanKeySecret;

  return razorpayInstance;
}

/**
 * Safely converts an amount in INR (Rupees) into an integer number of paise.
 * Razorpay expects all INR transaction amounts in paise (1 INR = 100 paise).
 *
 * @param {number|string} amountInRupees
 * @returns {number} Integer amount in paise
 */
function formatRazorpayAmount(amountInRupees) {
  const parsed = Number(amountInRupees);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid amount for Razorpay order: ${amountInRupees}`);
  }
  // Math.round eliminates JavaScript floating-point precision artifacts (e.g. 59.99 * 100)
  return Math.round(parsed * 100);
}

/**
 * Resets the cached singleton client (useful for unit tests or reload).
 */
function _resetRazorpayClientForTest() {
  razorpayInstance = null;
}

module.exports = {
  isRazorpayConfigured,
  getRazorpayClient,
  formatRazorpayAmount,
  _resetRazorpayClientForTest
};
