/**
 * server/src/controllers/financeController.js
 *
 * Finance & Financial Reconciliation Controller (Phase 4 & 5)
 *
 * Provides endpoints for Admin Finance Dashboard:
 *  - System-wide automated financial reconciliation
 *  - Per-booking financial reconciliation and invariant checks
 *  - Append-only financial audit log inspection and filtering
 *  - Payout audit trail resolution
 *  - System health diagnostics and stuck online payment recovery
 */

const defaultSupabase = require('../config/db');
const reconciliationService = require('../utils/reconciliationService');
const financialHealthService = require('../services/financialHealthService');
const fraudDetectionService = require('../services/fraudDetectionService');
const productionReadinessService = require('../services/productionReadinessService');

function getClient(req) {
  return req.supabase || defaultSupabase;
}

/**
 * GET /api/admin/finance/reconciliation
 * Runs automated reconciliation engine and returns system health and metrics.
 * Ingests any critical invariant issues into the incident management pipeline (Rule 5).
 */
exports.getReconciliationReport = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const report = await reconciliationService.runSystemReconciliation(client);

    // Rule 5: Automatically ingest critical reconciliation invariant issues into incidents
    if (report.issues && report.issues.length > 0) {
      await fraudDetectionService.ingestReconciliationIssues(client, report.issues);
    }

    res.json({
      success: true,
      report
    });
  } catch (err) {
    console.error('FINANCE RECONCILIATION ERROR:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to run financial reconciliation: ' + err.message
    });
  }
};

/**
 * GET /api/admin/finance/health
 * Production Readiness & Financial System Health Diagnostics (Phase 5).
 * Non-leaking diagnostic summary.
 */
exports.getFinancialHealth = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const health = await financialHealthService.runFinancialHealthCheck(client);
    res.json(health);
  } catch (err) {
    console.error('FINANCIAL HEALTH ERROR:', err);
    res.status(500).json({
      success: false,
      status: 'CRITICAL',
      message: 'Failed to run health check: ' + err.message
    });
  }
};

/**
 * GET /api/admin/finance/payment-recovery
 * Lists online payments stuck in 'pending' status older than threshold (15 minutes).
 * CRITICAL RULE: Admins cannot manually mark online payments as paid.
 */
exports.getPaymentRecoveryList = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const thresholdMinutes = parseInt(req.query?.thresholdMinutes, 10) || 15;
    const cutoffTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

    const { data: stuckPayments, error } = await client
      .from('payments')
      .select('*, booking:booking_id(id, booking_id, train_no, journey_date, status, passenger:passenger_id(id, name, email, phone))')
      .eq('status', 'pending')
      .neq('payment_method', 'cash')
      .lte('created_at', cutoffTime)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const recoveryList = (stuckPayments || []).map((p) => {
      const ageMinutes = Math.round((Date.now() - new Date(p.created_at).getTime()) / 60000);
      return {
        payment_id: p.id,
        booking_id: p.booking_id,
        amount: p.amount,
        payment_status: p.status,
        payment_method: p.payment_method,
        razorpay_order_id: p.razorpay_order_id,
        created_at: p.created_at,
        age_minutes: ageMinutes,
        is_stuck: ageMinutes >= thresholdMinutes,
        recovery_action: 'Automated Gateway Polling / Webhook Telemetry Sync',
        policy_reminder: 'Option C: Online payments cannot be manually marked paid'
      };
    });

    res.json({
      success: true,
      count: recoveryList.length,
      threshold_minutes: thresholdMinutes,
      stuck_payments: recoveryList
    });
  } catch (err) {
    console.error('GET PAYMENT RECOVERY ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve payment recovery list.' });
  }
};

/**
 * GET /api/admin/finance/refund-monitoring
 * Detailed telemetry on pending, processed, and failed refunds.
 */
exports.getRefundMonitoringList = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { data: allRefunds, error } = await client
      .from('refunds')
      .select('*, booking:booking_id(id, booking_id, status, passenger:passenger_id(name, email, phone)), payment:payment_id(id, amount, payment_method)')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, pending: [], processed: [], failed: [], high_value: [] });
      }
      return res.status(500).json({ message: error.message });
    }

    const refunds = allRefunds || [];
    const pending = refunds.filter((r) => r.status === 'pending' || r.status === 'requested');
    const processed = refunds.filter((r) => r.status === 'completed' || r.status === 'processed');
    const failed = refunds.filter((r) => r.status === 'failed');
    const highValue = refunds.filter((r) => Number(r.amount) >= 2000);

    res.json({
      success: true,
      stats: {
        total: refunds.length,
        pending_count: pending.length,
        processed_count: processed.length,
        failed_count: failed.length,
        high_value_count: highValue.length
      },
      pending,
      processed,
      failed,
      high_value: highValue
    });
  } catch (err) {
    console.error('GET REFUND MONITORING ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve refund monitoring data.' });
  }
};

/**
 * GET /api/admin/finance/payout-monitoring
 * Detailed telemetry on sahayak payouts, highlighting delayed reviews and failures.
 */
exports.getPayoutMonitoringList = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { data: allPayouts, error } = await client
      .from('assistant_payouts')
      .select('*, assistant:assistant_id(id, name, email, phone, station_code), items:assistant_payout_items(*, earning:earning_id(*))')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const payouts = allPayouts || [];
    const now = Date.now();

    // Delayed in requested > 24h
    const delayedRequested = payouts.filter((p) => {
      if (p.status !== 'requested') return false;
      const ageHours = (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
      return ageHours >= 24;
    });

    // Delayed in processing > 48h
    const delayedProcessing = payouts.filter((p) => {
      if (p.status !== 'processing') return false;
      const ageHours = (now - new Date(p.updated_at || p.created_at).getTime()) / (1000 * 60 * 60);
      return ageHours >= 48;
    });

    const failed = payouts.filter((p) => p.status === 'failed');
    const highValue = payouts.filter((p) => Number(p.amount) >= 5000);

    res.json({
      success: true,
      stats: {
        total: payouts.length,
        delayed_requested_count: delayedRequested.length,
        delayed_processing_count: delayedProcessing.length,
        failed_count: failed.length,
        high_value_count: highValue.length
      },
      delayed_requested: delayedRequested,
      delayed_processing: delayedProcessing,
      failed,
      high_value: highValue
    });
  } catch (err) {
    console.error('GET PAYOUT MONITORING ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve payout monitoring data.' });
  }
};

/**
 * GET /api/admin/finance/reconciliation/bookings/:id
 * Reconciles a single booking and its payments, earnings, and refunds.
 */
exports.getBookingReconciliation = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { id } = req.params;
    const result = await reconciliationService.reconcileBooking(client, id);
    if (!result.success) {
      return res.status(404).json({ success: false, message: result.error || 'Booking not found.' });
    }
    res.json(result);
  } catch (err) {
    console.error('BOOKING RECONCILIATION ERROR:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reconcile booking: ' + err.message
    });
  }
};

/**
 * GET /api/admin/finance/audit-logs
 * Retrieves append-only financial audit trail records with optional filtering.
 */
exports.getAuditLogs = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const {
      action,
      actor_role,
      entity_type,
      booking_id,
      payout_id,
      payment_id,
      limit = 50,
      offset = 0
    } = req.query || {};

    let query = client
      .from('financial_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (action && action !== 'ALL') {
      query = query.eq('action', action);
    }
    if (actor_role && actor_role !== 'ALL') {
      query = query.eq('actor_role', actor_role);
    }
    if (entity_type && entity_type !== 'ALL') {
      query = query.eq('entity_type', entity_type);
    }
    if (booking_id) {
      query = query.eq('booking_id', booking_id);
    }
    if (payout_id) {
      query = query.eq('payout_id', payout_id);
    }
    if (payment_id) {
      query = query.eq('payment_id', payment_id);
    }

    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

    query = query.range(pageOffset, pageOffset + pageLimit - 1);

    const { data: logs, count, error } = await query;

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        return res.json({
          success: true,
          logs: [],
          total: 0,
          limit: pageLimit,
          offset: pageOffset,
          notice: 'financial_audit_logs table has not been initialized yet.'
        });
      }
      return res.status(500).json({ message: error.message });
    }

    res.json({
      success: true,
      logs: logs || [],
      total: count || (logs ? logs.length : 0),
      limit: pageLimit,
      offset: pageOffset
    });
  } catch (err) {
    console.error('GET AUDIT LOGS ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve financial audit logs.' });
  }
};

/**
 * GET /api/admin/finance/payouts/:id/audit
 * Retrieves all financial audit log records linked to a specific payout.
 */
exports.getPayoutAudit = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const { id } = req.params;

    const { data: logs, error } = await client
      .from('financial_audit_logs')
      .select('*')
      .or(`payout_id.eq.${id},and(entity_type.eq.assistant_payout,entity_id.eq.${id})`)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, audit_trail: [] });
      }
      return res.status(500).json({ message: error.message });
    }

    res.json({
      success: true,
      payout_id: id,
      audit_trail: logs || []
    });
  } catch (err) {
    console.error('GET PAYOUT AUDIT ERROR:', err);
    res.status(500).json({ message: 'Unable to load payout audit trail.' });
  }
};

/**
 * GET /api/admin/finance/production-readiness
 * Returns comprehensive Phase 6 production readiness and security posture report.
 */
exports.getProductionReadiness = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const client = getClient(req);
    const report = await productionReadinessService.getProductionReadinessReport(client);

    res.json({
      success: true,
      ...report
    });
  } catch (err) {
    console.error('GET PRODUCTION READINESS ERROR:', err);
    res.status(500).json({ message: 'Unable to evaluate production readiness.' });
  }
};

