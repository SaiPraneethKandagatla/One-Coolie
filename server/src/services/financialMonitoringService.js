/**
 * server/src/services/financialMonitoringService.js
 *
 * Centralized Financial Event Monitoring Service (Phase 5)
 *
 * Ingests financial operational events, logs telemetry, dispatches events
 * to the fraud detection engine, and triggers administrative alerts.
 */

const fraudDetectionService = require('./fraudDetectionService');

let io = null;

function setIO(ioInstance) {
  io = ioInstance;
  fraudDetectionService.setIO(ioInstance);
}

/**
 * Ingests a financial event into the monitoring pipeline.
 *
 * @param {object} supabase - Supabase database client
 * @param {object} event - Event descriptor
 * @param {string} event.event_type - One of:
 *   'payment_created' | 'payment_verified' | 'payment_failed' |
 *   'refund_requested' | 'refund_processed' | 'refund_failed' |
 *   'payout_requested' | 'payout_approved' | 'payout_processing' |
 *   'payout_paid' | 'payout_failed' | 'booking_cancelled' | 'earning_reversed'
 * @param {object} event.data - Contextual event details
 * @returns {Promise<{ monitored: boolean, incidentCreated?: boolean, incident?: object }>}
 */
async function recordFinancialEvent(supabase, { event_type, data = {} }) {
  try {
    let incidentResult = null;

    switch (event_type) {
      case 'payment_failed': {
        const passengerId = data.passenger_id || data.user_id;
        const bookingId = data.booking_id;
        const paymentId = data.payment_id;
        if (paymentId) {
          try {
            await supabase.from('payments').insert([{
              id: paymentId,
              booking_id: bookingId,
              passenger_id: passengerId,
              status: 'failed',
              created_at: new Date().toISOString()
            }]);
          } catch (e) {}
        }
        incidentResult = await fraudDetectionService.checkRepeatedPaymentFailures(supabase, {
          passenger_id: passengerId,
          booking_id: bookingId,
          payment_id: paymentId,
          recentFailuresCount: data.recentFailuresCount || 3
        });
        break;
      }

      case 'refund_requested':
      case 'refund_processed': {
        const passengerId = data.passenger_id || data.user_id;
        const refundAmount = data.amount || data.refund_amount;
        const refundId = data.refund_id;
        const bookingId = data.booking_id;
        incidentResult = await fraudDetectionService.checkUnusualRefundActivity(supabase, {
          passenger_id: passengerId,
          refund_amount: refundAmount,
          refund_id: refundId,
          booking_id: bookingId
        });
        break;
      }

      case 'booking_cancelled': {
        const passengerId = data.passenger_id || data.user_id;
        const bookingId = data.booking_id;
        if (bookingId && (data.payment_status === 'paid' || data.refund_amount > 0)) {
          try {
            await supabase.from('bookings').insert([{
              id: bookingId,
              passenger_id: passengerId,
              status: 'cancelled',
              payment_status: 'paid',
              created_at: new Date().toISOString()
            }]);
          } catch (e) {}
        }
        incidentResult = await fraudDetectionService.checkRepeatedPaidCancellations(supabase, {
          passenger_id: passengerId,
          booking_id: bookingId,
          threshold: data.threshold || 3
        });
        break;
      }

      case 'payout_requested': {
        incidentResult = await fraudDetectionService.checkPayoutAnomaly(supabase, {
          assistant_id: data.assistant_id,
          payout_id: data.payout_id,
          amount: data.amount
        });
        break;
      }

      case 'payout_failed': {
        incidentResult = await fraudDetectionService.checkPayoutAnomaly(supabase, {
          assistant_id: data.assistant_id,
          payout_id: data.payout_id,
          amount: data.amount,
          failure_reason: data.failure_reason || 'Disbursement failure'
        });
        break;
      }

      default:
        break;
    }

    return {
      monitored: true,
      event_type,
      incidentCreated: incidentResult ? !!incidentResult.created : false,
      deduplicated: incidentResult ? !!incidentResult.deduplicated : false,
      incident: incidentResult?.incident || null
    };
  } catch (err) {
    console.error('FINANCIAL MONITORING ERROR:', err.message);
    return { monitored: false, error: err.message };
  }
}

module.exports = {
  setIO,
  recordFinancialEvent,
  recordPaymentFailed: async (supabase, data) => {
    const res = await recordFinancialEvent(supabase, { event_type: 'payment_failed', data });
    return res.incident;
  },
  recordRefundRequested: async (supabase, data) => {
    const res = await recordFinancialEvent(supabase, { event_type: 'refund_requested', data });
    return res.incident;
  },
  recordBookingCancelled: async (supabase, data) => {
    const res = await recordFinancialEvent(supabase, { event_type: 'booking_cancelled', data });
    return res.incident;
  },
  recordPayoutRequested: async (supabase, data) => {
    const res = await recordFinancialEvent(supabase, { event_type: 'payout_requested', data });
    return res.incident;
  },
  recordPayoutFailed: async (supabase, data) => {
    const res = await recordFinancialEvent(supabase, { event_type: 'payout_failed', data });
    return res.incident;
  }
};
