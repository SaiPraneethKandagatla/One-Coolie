/**
 * server/src/utils/cancellationRules.js
 *
 * Centralized Cancellation & Refund Rules Engine for ONECOOLIE (Phase 3A)
 *
 * Enforces Option C business rules across all lifecycle stages:
 * - Cash bookings before collection: cancel booking & payment, NO gateway refund.
 * - Cash bookings after collection: passenger self-cancellation rejected.
 * - Online bookings pending: cancel booking & payment, NO gateway refund.
 * - Online bookings paid before acceptance: 100% gateway refund.
 * - Online bookings paid after acceptance (accepted/arriving): configurable refund (default 100%).
 * - Service in_service: passenger self-cancellation strictly rejected.
 * - Service completed: cancellation strictly rejected.
 * - Already cancelled: idempotent rejection / acknowledgement.
 */

const { isCashPayment, isOnlinePayment } = require('./paymentClassification');

// Policy constants (configurable)
const PASSENGER_CANCEL_BEFORE_ACCEPT_REFUND_PERCENT = 100;
const PASSENGER_CANCEL_AFTER_ACCEPT_REFUND_PERCENT = 100;

/**
 * Evaluates whether a passenger is permitted to cancel the booking.
 *
 * @param {object} booking - Booking row
 * @param {object} [payment] - Associated payment row
 * @returns {{ allowed: boolean, isAlreadyCancelled?: boolean, reason?: string }}
 */
function canPassengerCancel(booking, payment) {
  if (!booking) {
    return { allowed: false, reason: 'Booking not found.' };
  }

  const bookingStatus = String(booking.booking_status || '').toLowerCase();
  const paymentStatus = String(payment?.status || booking.payment_status || '').toLowerCase();
  const paymentMethod = booking.payment_method;

  // 1. Check if already cancelled
  if (bookingStatus === 'cancelled') {
    return {
      allowed: false,
      isAlreadyCancelled: true,
      reason: 'Booking is already cancelled.'
    };
  }

  // 2. Completed bookings cannot be cancelled
  if (bookingStatus === 'completed') {
    return {
      allowed: false,
      reason: 'Completed bookings cannot be cancelled.'
    };
  }

  // 3. Cash booking rule: once cash has been collected, self-cancellation is disallowed
  if (isCashPayment(paymentMethod) && paymentStatus === 'paid') {
    return {
      allowed: false,
      reason: 'Cash payment has already been collected by the assistant. Please contact support or admin for assistance.'
    };
  }

  // 4. In-service bookings cannot be self-cancelled by passenger
  if (bookingStatus === 'in_service') {
    return {
      allowed: false,
      reason: 'Service is currently in progress. Cancellations are not permitted once assistance has started.'
    };
  }

  // 5. Cash booking rules (pending payment)
  if (isCashPayment(paymentMethod)) {
    if (['pending', 'accepted', 'arriving'].includes(bookingStatus)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Cash booking cannot be cancelled at '${bookingStatus}' stage.`
    };
  }

  // 5. Online payment rules
  if (isOnlinePayment(paymentMethod)) {
    // Online bookings at pending, accepted, or arriving can be cancelled
    if (['pending', 'accepted', 'arriving'].includes(bookingStatus)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Online booking cannot be cancelled at '${bookingStatus}' stage.`
    };
  }

  // Fallback
  return {
    allowed: ['pending', 'accepted', 'arriving'].includes(bookingStatus),
    reason: 'Booking cannot be cancelled at this stage.'
  };
}

/**
 * Evaluates whether an assistant is permitted to cancel/release an assigned booking.
 *
 * @param {object} booking
 * @param {string} assistantUserId
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canAssistantCancel(booking, assistantUserId) {
  if (!booking) {
    return { allowed: false, reason: 'Job not found.' };
  }

  if (booking.assistant_id !== assistantUserId) {
    return { allowed: false, reason: 'You are not assigned to this job.' };
  }

  const status = String(booking.booking_status || '').toLowerCase();
  if (!['accepted', 'arriving'].includes(status)) {
    return {
      allowed: false,
      reason: 'Job cannot be cancelled at this stage. Service has already started or completed.'
    };
  }

  return { allowed: true };
}

/**
 * Evaluates whether an admin can cancel the booking.
 *
 * @param {object} booking
 * @returns {{ allowed: boolean, isAlreadyCancelled?: boolean, reason?: string }}
 */
function canAdminCancel(booking) {
  if (!booking) {
    return { allowed: false, reason: 'Booking not found.' };
  }

  if (String(booking.booking_status || '').toLowerCase() === 'cancelled') {
    return {
      allowed: false,
      isAlreadyCancelled: true,
      reason: 'Booking is already cancelled.'
    };
  }

  return { allowed: true };
}

/**
 * Authoritatively determines refund eligibility and calculation.
 *
 * @param {object} booking
 * @param {object} [payment]
 * @param {string} [actorRole='passenger']
 * @returns {{
 *   requiresRefund: boolean,
 *   refundPercent: number,
 *   refundAmount: number,
 *   originalAmount: number,
 *   reason: string
 * }}
 */
function determineRefundEligibility(booking, payment, actorRole = 'passenger') {
  const originalAmount = Number(payment?.amount || booking.total_price || 0);
  const paymentMethod = booking.payment_method;
  const paymentStatus = String(payment?.status || booking.payment_status || '').toLowerCase();
  const bookingStatus = String(booking.booking_status || '').toLowerCase();

  // 1. Cash bookings never produce gateway refunds
  if (isCashPayment(paymentMethod)) {
    return {
      requiresRefund: false,
      refundPercent: 0,
      refundAmount: 0,
      originalAmount,
      reason: 'Cash booking does not require gateway refund.'
    };
  }

  // 2. Online bookings where payment was never completed / still pending
  if (isOnlinePayment(paymentMethod) && paymentStatus !== 'paid') {
    return {
      requiresRefund: false,
      refundPercent: 0,
      refundAmount: 0,
      originalAmount,
      reason: 'Online payment was not captured or is pending. No gateway refund required.'
    };
  }

  // 3. Online bookings that have been verified and paid
  if (isOnlinePayment(paymentMethod) && paymentStatus === 'paid') {
    let refundPercent = 100;

    if (bookingStatus === 'pending') {
      // Unassigned job: full refund
      refundPercent = PASSENGER_CANCEL_BEFORE_ACCEPT_REFUND_PERCENT;
    } else if (['accepted', 'arriving'].includes(bookingStatus)) {
      // Assigned sahayak but not in-service: configurable refund percentage
      refundPercent = PASSENGER_CANCEL_AFTER_ACCEPT_REFUND_PERCENT;
    }

    const calculated = Math.round((originalAmount * refundPercent) / 100 * 100) / 100;

    return {
      requiresRefund: calculated > 0,
      refundPercent,
      refundAmount: calculated,
      originalAmount,
      reason: `Verified online payment cancellation refund (${refundPercent}%).`
    };
  }

  return {
    requiresRefund: false,
    refundPercent: 0,
    refundAmount: 0,
    originalAmount,
    reason: 'Payment method or status not eligible for gateway refund.'
  };
}

module.exports = {
  PASSENGER_CANCEL_BEFORE_ACCEPT_REFUND_PERCENT,
  PASSENGER_CANCEL_AFTER_ACCEPT_REFUND_PERCENT,
  canPassengerCancel,
  canAssistantCancel,
  canAdminCancel,
  determineRefundEligibility
};
