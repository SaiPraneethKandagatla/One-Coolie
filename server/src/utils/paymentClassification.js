/**
 * server/src/utils/paymentClassification.js
 *
 * Centralized Payment Method Classification for ONECOOLIE
 *
 * Enforces Option C (Cash + Online Hybrid) payment rules:
 * - CASH: Booking created -> broadcast immediately -> assistant accepts ->
 *         arrives -> OTP verified -> cash collected -> paid -> completed -> earnings
 * - ONLINE: Booking created (pending) -> payment verified (paid) ->
 *           broadcast to assistants -> accepted -> arrives -> OTP verified -> completed -> earnings
 */

const CASH_PAYMENT_METHODS = ['cash'];

const ONLINE_PAYMENT_METHODS = [
  'upi',
  'online',
  'card',
  'netbanking'
];

/**
 * Safely normalizes payment method string (trimmed, lowercased).
 * @param {string} method
 * @returns {string}
 */
function normalizePaymentMethod(method) {
  if (!method || typeof method !== 'string') return '';
  return method.trim().toLowerCase();
}

/**
 * Checks if the payment method is cash.
 * @param {string} method
 * @returns {boolean}
 */
function isCashPayment(method) {
  const normalized = normalizePaymentMethod(method);
  return CASH_PAYMENT_METHODS.includes(normalized);
}

/**
 * Checks if the payment method is an online method (UPI, netbanking, card, etc.)
 * @param {string} method
 * @returns {boolean}
 */
function isOnlinePayment(method) {
  const normalized = normalizePaymentMethod(method);
  return ONLINE_PAYMENT_METHODS.includes(normalized);
}

/**
 * Validates whether the given method is supported by the platform.
 * @param {string} method
 * @returns {boolean}
 */
function isValidPaymentMethod(method) {
  const normalized = normalizePaymentMethod(method);
  return CASH_PAYMENT_METHODS.includes(normalized) || ONLINE_PAYMENT_METHODS.includes(normalized);
}

/**
 * Determines if a booking is currently visible/available for assistants to accept.
 *
 * Business Rules (Option C):
 * 1. Cash booking: Available if booking_status is 'pending' (even if payment_status is 'pending')
 * 2. Online booking: Available ONLY if booking_status is 'pending' AND payment_status is 'paid'
 * 3. Any other status: NOT available
 *
 * @param {object} booking
 * @returns {boolean}
 */
function isBookingAvailableToAssistants(booking) {
  if (!booking) return false;

  const bookingStatus = String(booking.booking_status || '').toLowerCase();
  if (bookingStatus !== 'pending') {
    return false;
  }

  // Already assigned to an assistant?
  if (booking.assistant_id) {
    return false;
  }

  const method = normalizePaymentMethod(booking.payment_method);
  const paymentStatus = String(booking.payment_status || '').toLowerCase();

  if (isCashPayment(method)) {
    // Cash bookings are available while pending
    return true;
  }

  if (isOnlinePayment(method)) {
    // Online bookings MUST be paid first before becoming available
    return paymentStatus === 'paid';
  }

  return false;
}

module.exports = {
  CASH_PAYMENT_METHODS,
  ONLINE_PAYMENT_METHODS,
  normalizePaymentMethod,
  isCashPayment,
  isOnlinePayment,
  isValidPaymentMethod,
  isBookingAvailableToAssistants,
  isBookingVisibleToAssistants: isBookingAvailableToAssistants
};
