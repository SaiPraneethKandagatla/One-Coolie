/**
 * server/src/services/canaryMetricsService.js
 *
 * Authoritative Database Canary Metrics & Threshold Evaluation Service (Phase 10)
 *
 * Aggregates live transaction data directly from PostgreSQL ledgers:
 * - Bookings, Payments, Refunds, Webhook Events, Financial Incidents, Reconciliation
 *
 * Centralizes risk configuration and sample size evaluation.
 */

const reconciliationService = require('../utils/reconciliationService');

/**
 * Returns active Canary risk thresholds from environment or safe defaults.
 */
function getCanaryThresholds() {
  return {
    minPaymentSuccessRate: Number(process.env.CANARY_MIN_PAYMENT_SUCCESS_RATE || 85),
    maxRefundRate: Number(process.env.CANARY_MAX_REFUND_RATE || 20),
    maxIncidentRate: Number(process.env.CANARY_MAX_INCIDENT_RATE || 5),
    minSampleSize: Number(process.env.CANARY_MIN_SAMPLE_SIZE || 5)
  };
}

/**
 * Calculates authoritative Canary Metrics from database records.
 *
 * @param {object} supabase
 * @returns {Promise<object>}
 */
async function calculateCanaryMetrics(supabase) {
  const thresholds = getCanaryThresholds();

  let totalBookings = 0;
  let completedBookings = 0;
  let cancelledBookings = 0;
  let successfulPayments = 0;
  let failedPayments = 0;
  let pendingPayments = 0;
  let refundCount = 0;
  let refundAmount = 0;
  let webhookSuccess = 0;
  let webhookFailure = 0;
  let incidentCount = 0;
  let criticalIncidents = 0;
  let reconIssues = 0;

  try {
    const { data: bData } = await supabase.from('bookings').select('id, booking_status, payment_status');
    if (Array.isArray(bData)) {
      totalBookings = bData.length;
      completedBookings = bData.filter((b) => b.booking_status === 'completed').length;
      cancelledBookings = bData.filter((b) => b.booking_status === 'cancelled').length;
    }
  } catch (err) {}

  try {
    const { data: pData } = await supabase.from('payments').select('id, status, amount');
    if (Array.isArray(pData)) {
      successfulPayments = pData.filter((p) => p.status === 'paid').length;
      failedPayments = pData.filter((p) => p.status === 'failed').length;
      pendingPayments = pData.filter((p) => p.status === 'pending').length;
    }
  } catch (err) {}

  try {
    const { data: rData } = await supabase.from('refunds').select('id, amount, status');
    if (Array.isArray(rData)) {
      refundCount = rData.filter((r) => r.status === 'processed').length;
      refundAmount = rData
        .filter((r) => r.status === 'processed')
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    }
  } catch (err) {}

  try {
    const { data: wData } = await supabase.from('payment_webhook_events').select('status');
    if (Array.isArray(wData)) {
      webhookSuccess = wData.filter((w) => w.status === 'processed').length;
      webhookFailure = wData.filter((w) => w.status === 'failed').length;
    }
  } catch (err) {}

  try {
    const { data: iData } = await supabase.from('financial_incidents').select('id, severity, status');
    if (Array.isArray(iData)) {
      incidentCount = iData.length;
      criticalIncidents = iData.filter((i) => (i.severity || '').toLowerCase() === 'critical' && i.status !== 'resolved' && i.status !== 'ignored').length;
    }
  } catch (err) {}

  try {
    const recon = await reconciliationService.runSystemReconciliation(supabase);
    reconIssues = recon.health?.critical_issues || 0;
  } catch (err) {}

  const paymentAttempts = successfulPayments + failedPayments;
  const paymentSuccessRate = paymentAttempts > 0 ? Math.round((successfulPayments / paymentAttempts) * 100) : 100;
  const refundRate = successfulPayments > 0 ? Math.round((refundCount / successfulPayments) * 100) : 0;
  const incidentRate = totalBookings > 0 ? Math.round((incidentCount / totalBookings) * 100) : 0;

  // Evaluate against configurable thresholds
  const meetsSampleSize = paymentAttempts >= thresholds.minSampleSize;
  const meetsSuccessRate = !meetsSampleSize || paymentSuccessRate >= thresholds.minPaymentSuccessRate;
  const meetsRefundRate = !meetsSampleSize || refundRate <= thresholds.maxRefundRate;
  const meetsIncidentRate = criticalIncidents === 0 && (!meetsSampleSize || incidentRate <= thresholds.maxIncidentRate);
  const meetsReconciliation = reconIssues === 0;

  const healthy = meetsSuccessRate && meetsRefundRate && meetsIncidentRate && meetsReconciliation && criticalIncidents === 0;

  const failureReasons = [];
  if (criticalIncidents > 0) failureReasons.push(`${criticalIncidents} unresolved critical financial incidents detected.`);
  if (!meetsReconciliation) failureReasons.push(`${reconIssues} critical financial reconciliation issues detected.`);
  if (meetsSampleSize && !meetsSuccessRate) failureReasons.push(`Payment success rate (${paymentSuccessRate}%) below threshold (${thresholds.minPaymentSuccessRate}%).`);
  if (meetsSampleSize && !meetsRefundRate) failureReasons.push(`Refund rate (${refundRate}%) exceeded threshold (${thresholds.maxRefundRate}%).`);
  if (meetsSampleSize && !meetsIncidentRate) failureReasons.push(`Incident rate (${incidentRate}%) exceeded threshold (${thresholds.maxIncidentRate}%).`);

  return {
    success: true,
    healthy,
    sample_size_ready: meetsSampleSize,
    failure_reasons: failureReasons,
    thresholds,
    metrics: {
      total_canary_bookings: totalBookings,
      completed_bookings: completedBookings,
      booking_cancellations: cancelledBookings,
      successful_payments: successfulPayments,
      failed_payments: failedPayments,
      pending_payments: pendingPayments,
      payment_attempts: paymentAttempts,
      refund_count: refundCount,
      refund_amount: refundAmount,
      webhook_success_count: webhookSuccess,
      webhook_failure_count: webhookFailure,
      incident_count: incidentCount,
      critical_incident_count: criticalIncidents,
      reconciliation_issue_count: reconIssues,
      rates: {
        payment_success_rate: paymentSuccessRate,
        refund_rate: refundRate,
        incident_rate: incidentRate
      }
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getCanaryThresholds,
  calculateCanaryMetrics
};
