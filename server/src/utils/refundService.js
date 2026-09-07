/**
 * server/src/utils/refundService.js
 *
 * Centralized Refund Ledger & Razorpay Refund Integration Service (Phase 3A)
 *
 * Responsibilities:
 * - Server-side authoritative refund calculations (client amounts ignored).
 * - Enforcing the Financial Invariant: total_refunded <= original_payment_amount.
 * - Idempotent deduplication of multiple refund attempts.
 * - Integrating with the official Razorpay singleton client.
 * - Maintaining the `refunds` ledger table.
 */

const razorpayConfig = require('../config/razorpay');

/**
 * Calculates refund amount rounded to 2 decimal places.
 *
 * @param {number} originalAmount
 * @param {number} percent
 * @returns {number}
 */
function calculateRefundAmount(originalAmount, percent) {
  const parsed = Number(originalAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.round((parsed * pct) / 100 * 100) / 100;
}

/**
 * Retrieves cumulative refund summary for a specific payment.
 *
 * @param {object} supabaseClient
 * @param {string} paymentId
 * @returns {Promise<{
 *   totalRefunded: number,
 *   processedRefunds: object[],
 *   pendingRefunds: object[],
 *   failedRefunds: object[]
 * }>}
 */
async function getRefundSummaryForPayment(supabaseClient, paymentId) {
  if (!paymentId) {
    return {
      totalRefunded: 0,
      processedRefunds: [],
      pendingRefunds: [],
      failedRefunds: []
    };
  }

  try {
    const { data: refunds, error } = await supabaseClient
      .from('refunds')
      .select('*')
      .eq('payment_id', paymentId);

    if (error || !refunds) {
      return {
        totalRefunded: 0,
        processedRefunds: [],
        pendingRefunds: [],
        failedRefunds: []
      };
    }

    const processed = refunds.filter((r) => r.status === 'processed');
    const pending = refunds.filter((r) => ['pending', 'processing'].includes(r.status));
    const failed = refunds.filter((r) => r.status === 'failed');

    const totalRefunded = processed.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return {
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      processedRefunds: processed,
      pendingRefunds: pending,
      failedRefunds: failed
    };
  } catch (err) {
    console.warn('getRefundSummaryForPayment notice:', err.message);
    return {
      totalRefunded: 0,
      processedRefunds: [],
      pendingRefunds: [],
      failedRefunds: []
    };
  }
}

/**
 * Calls Razorpay's server-side refund API using the verified gateway_payment_id.
 *
 * @param {string} gatewayPaymentId - e.g. pay_xxx
 * @param {number} amountInRupees - Refund amount in INR
 * @param {object} [notes={}] - Optional metadata
 * @returns {Promise<{
 *   success: boolean,
 *   gatewayRefundId?: string,
 *   gatewayStatus?: string,
 *   rawResponse?: object,
 *   error?: string
 * }>}
 */
async function initiateRazorpayRefund(gatewayPaymentId, amountInRupees, notes = {}) {
  if (!gatewayPaymentId) {
    return {
      success: false,
      error: 'Missing Razorpay gateway payment ID for refund.'
    };
  }

  if (!razorpayConfig.isRazorpayConfigured()) {
    return {
      success: false,
      error: 'Razorpay gateway credentials are not configured on this server.'
    };
  }

  try {
    const razorpay = razorpayConfig.getRazorpayClient();
    const amountInPaise = razorpayConfig.formatRazorpayAmount(amountInRupees);

    // Call official Razorpay payments.refund API
    const refundRes = await razorpay.payments.refund(gatewayPaymentId, {
      amount: amountInPaise,
      notes: {
        ...notes,
        initiated_by: 'onecoolie_refund_engine'
      }
    });

    return {
      success: true,
      gatewayRefundId: refundRes.id,
      gatewayStatus: refundRes.status || 'processed',
      rawResponse: refundRes
    };
  } catch (gatewayErr) {
    console.error('RAZORPAY REFUND API ERROR:', gatewayErr.message || gatewayErr);
    return {
      success: false,
      error: gatewayErr.error?.description || gatewayErr.message || 'Razorpay refund request failed.'
    };
  }
}

/**
 * Authoritatively executes a booking refund:
 * 1. Checks idempotency & existing refunds
 * 2. Enforces Financial Invariant (total_refunded + amount <= original_payment)
 * 3. Creates pending refund record
 * 4. Calls Razorpay gateway refund API
 * 5. Updates refund record to 'processed' (or 'failed')
 *
 * @param {object} supabaseClient
 * @param {object} params
 * @param {object} params.booking
 * @param {object} params.payment
 * @param {number} params.refundAmount
 * @param {string} [params.reason]
 * @param {string} [params.actorRole]
 * @param {string} [params.actorId]
 * @returns {Promise<{
 *   success: boolean,
 *   idempotent?: boolean,
 *   refund?: object,
 *   message?: string
 * }>}
 */
async function processBookingRefund(supabaseClient, {
  booking,
  payment,
  refundAmount,
  reason = 'Booking cancellation refund',
  actorRole = 'passenger',
  actorId = null
}) {
  if (!booking || !payment) {
    return { success: false, message: 'Valid booking and payment records are required for refund.' };
  }

  const originalAmount = Number(payment.amount || booking.total_price || 0);

  // 1. Check existing refunds for idempotency and cumulative limits
  const summary = await getRefundSummaryForPayment(supabaseClient, payment.id);

  // If already fully refunded, return idempotent success
  if (summary.totalRefunded >= originalAmount && summary.totalRefunded > 0) {
    return {
      success: true,
      idempotent: true,
      refund: summary.processedRefunds[0] || null,
      message: 'Payment has already been fully refunded.'
    };
  }

  // Enforce Financial Invariant: cannot refund more than original payment
  const remainingRefundable = Math.max(0, originalAmount - summary.totalRefunded);
  if (remainingRefundable <= 0) {
    return {
      success: false,
      message: 'Cumulative refunds have already reached the original payment amount.'
    };
  }

  // Adjust refund amount to not exceed remaining refundable amount
  const finalAmount = Math.min(Number(refundAmount), remainingRefundable);
  if (finalAmount <= 0) {
    return { success: false, message: 'Refund amount must be greater than zero.' };
  }

  const nowIso = new Date().toISOString();

  // 2. Create initial 'pending' refund record in database
  let refundRecord = null;
  try {
    const { data: inserted, error: insertErr } = await supabaseClient
      .from('refunds')
      .insert([{
        booking_id: booking.id,
        payment_id: payment.id,
        passenger_id: booking.passenger_id || actorId,
        amount: finalAmount,
        currency: payment.currency || 'INR',
        payment_gateway: 'razorpay',
        gateway_payment_id: payment.gateway_payment_id,
        status: 'pending',
        reason,
        metadata: {
          actor_role: actorRole,
          actor_id: actorId,
          original_payment_amount: originalAmount,
          cumulative_prior_refunds: summary.totalRefunded
        },
        created_at: nowIso,
        updated_at: nowIso
      }])
      .select()
      .single();

    if (insertErr) {
      console.error('REFUND RECORD CREATION ERROR:', insertErr);
    } else {
      refundRecord = inserted;
    }
  } catch (dbErr) {
    console.warn('Refunds ledger insert notice:', dbErr.message);
  }

  // 3. Dispatch to Razorpay Gateway API
  const gatewayResult = await initiateRazorpayRefund(
    payment.gateway_payment_id,
    finalAmount,
    {
      booking_id: booking.id,
      booking_number: booking.booking_id,
      payment_id: payment.id,
      refund_record_id: refundRecord?.id || ''
    }
  );

  // 4. Update refund record state based on gateway outcome
  if (gatewayResult.success) {
    if (refundRecord?.id) {
      try {
        const { data: updated } = await supabaseClient
          .from('refunds')
          .update({
            status: 'processed',
            gateway_refund_id: gatewayResult.gatewayRefundId,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', refundRecord.id)
          .select()
          .maybeSingle();

        if (updated) refundRecord = updated;
      } catch (uErr) {}
    }

    // Update payment record metadata with refund reference
    try {
      await supabaseClient
        .from('payments')
        .update({
          status: summary.totalRefunded + finalAmount >= originalAmount ? 'refunded' : 'paid',
          metadata: {
            ...(payment.metadata || {}),
            has_refund: true,
            total_refunded: summary.totalRefunded + finalAmount,
            last_refund_id: gatewayResult.gatewayRefundId,
            last_refund_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);
    } catch (pErr) {}

    return {
      success: true,
      idempotent: false,
      refund: refundRecord,
      message: `Refund of ₹${finalAmount} processed successfully.`
    };
  } else {
    // Gateway call failed
    if (refundRecord?.id) {
      try {
        await supabaseClient
          .from('refunds')
          .update({
            status: 'failed',
            failure_reason: gatewayResult.error,
            updated_at: new Date().toISOString()
          })
          .eq('id', refundRecord.id);
      } catch (fErr) {}
    }

    return {
      success: false,
      error: gatewayResult.error,
      refund: refundRecord,
      message: `Gateway refund failed: ${gatewayResult.error}`
    };
  }
}

module.exports = {
  calculateRefundAmount,
  getRefundSummaryForPayment,
  initiateRazorpayRefund,
  processBookingRefund
};
