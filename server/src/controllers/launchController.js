/**
 * server/src/controllers/launchController.js
 *
 * Controller for Live Production Validation, Canary Operations & Launch Certification (Phases 9 & 10)
 *
 * RESTRICTED: Admin only.
 * STRICT SECURITY: Zero secrets or tokens are ever exposed in API responses.
 */

const supabase = require('../config/db');
const {
  createValidationSession,
  getValidationSession,
  listValidationSessions,
  getSessionEvidence,
  createValidationBookingOrder,
  verifyLivePayment,
  verifyWebhookDelivery,
  verifyPaymentRecovery,
  verifyRefundAndReversal,
  verifyWalletAndSettlement
} = require('../services/liveValidationService');
const {
  getCanaryState,
  getCanaryMetrics,
  enableCanary,
  pauseCanary,
  resumeCanary,
  advanceCanaryStage,
  transitionToInternal,
  transitionToLimited,
  transitionToPercentage,
  transitionToPublic
} = require('../services/canaryService');
const { evaluateLaunchCertification } = require('../services/launchCertificationService');
const { validateProductionDeployment } = require('../services/productionDeploymentService');

/**
 * GET /api/admin/finance/deployment-status
 */
exports.getDeploymentStatus = async (req, res) => {
  try {
    const status = await validateProductionDeployment(supabase, req);
    return res.json(status);
  } catch (err) {
    console.error('DEPLOYMENT STATUS ERROR:', err);
    return res.status(500).json({ message: err.message || 'Failed to check deployment status.' });
  }
};

/**
 * POST /api/admin/finance/launch/sessions
 * POST /api/admin/finance/live-validation/session
 */
exports.createSession = async (req, res) => {
  try {
    const { environment, notes, metadata } = req.body || {};
    const session = await createValidationSession(supabase, {
      startedBy: req.user.id,
      environment,
      notes,
      metadata,
      backendUrl: req.body.backend_url,
      frontendUrl: req.body.frontend_url
    });

    return res.status(201).json({
      success: true,
      message: 'Production validation session initiated.',
      session
    });
  } catch (err) {
    console.error('CREATE VALIDATION SESSION ERROR:', err);
    return res.status(500).json({ message: err.message || 'Failed to create validation session.' });
  }
};

/**
 * GET /api/admin/finance/launch/sessions
 * GET /api/admin/finance/live-validation
 */
exports.listSessions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const sessions = await listValidationSessions(supabase, { limit, offset });

    return res.json({
      success: true,
      sessions
    });
  } catch (err) {
    console.error('LIST SESSIONS ERROR:', err);
    return res.status(500).json({ message: err.message || 'Failed to list validation sessions.' });
  }
};

/**
 * GET /api/admin/finance/launch/sessions/:id
 */
exports.getSessionById = async (req, res) => {
  try {
    const session = await getValidationSession(supabase, req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Validation session not found.' });
    }

    return res.json({
      success: true,
      session
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch validation session.' });
  }
};

/**
 * GET /api/admin/finance/launch/sessions/:id/evidence
 * GET /api/admin/finance/live-validation/evidence
 */
exports.getSessionEvidenceList = async (req, res) => {
  try {
    const sessionId = req.params.id || req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ message: 'session_id is required.' });
    }
    const evidence = await getSessionEvidence(supabase, sessionId);
    return res.json({
      success: true,
      session_id: sessionId,
      evidence
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch session evidence.' });
  }
};

/**
 * POST /api/admin/finance/launch/create-validation-order
 * POST /api/admin/finance/live-validation/order
 */
exports.createValidationOrder = async (req, res) => {
  try {
    const { session_id, train_number, train_name, station_code, require_live_mode } = req.body || {};
    if (!session_id) {
      return res.status(400).json({ message: 'session_id is required for validation booking.' });
    }

    const orderData = await createValidationBookingOrder(supabase, {
      adminUser: req.user,
      sessionId: session_id,
      trainNumber: train_number,
      trainName: train_name,
      stationCode: station_code,
      requireLiveMode: Boolean(require_live_mode)
    });

    if (orderData.blocked) {
      return res.status(400).json(orderData);
    }

    return res.status(201).json(orderData);
  } catch (err) {
    console.error('CREATE VALIDATION ORDER ERROR:', err);
    return res.status(400).json({ message: err.message || 'Failed to create validation order.' });
  }
};

/**
 * POST /api/admin/finance/launch/sessions/:id/validate-payment
 * POST /api/admin/finance/live-validation/verify-payment
 */
exports.validateLivePayment = async (req, res) => {
  try {
    const sessionId = req.params.id || req.body.session_id;
    const { payment_id } = req.body || {};
    if (!sessionId || !payment_id) {
      return res.status(400).json({ message: 'session_id and payment_id are required.' });
    }

    const result = await verifyLivePayment(supabase, {
      sessionId,
      paymentId: payment_id,
      actorId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Live payment verified and recorded in evidence ledger.',
      result
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/sessions/:id/validate-webhook
 */
exports.validateWebhook = async (req, res) => {
  try {
    const { payment_id } = req.body || {};
    if (!payment_id) {
      return res.status(400).json({ message: 'payment_id is required.' });
    }

    const result = await verifyWebhookDelivery(supabase, {
      sessionId: req.params.id,
      paymentId: payment_id,
      actorId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Webhook delivery certified and recorded in evidence ledger.',
      result
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/sessions/:id/validate-recovery
 */
exports.validateRecovery = async (req, res) => {
  try {
    const { payment_id } = req.body || {};
    if (!payment_id) {
      return res.status(400).json({ message: 'payment_id is required.' });
    }

    const result = await verifyPaymentRecovery(supabase, {
      sessionId: req.params.id,
      paymentId: payment_id,
      actorId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Payment recovery confirmed and recorded.',
      result
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/sessions/:id/validate-refund
 */
exports.validateRefund = async (req, res) => {
  try {
    const { refund_id } = req.body || {};
    if (!refund_id) {
      return res.status(400).json({ message: 'refund_id is required.' });
    }

    const result = await verifyRefundAndReversal(supabase, {
      sessionId: req.params.id,
      refundId: refund_id,
      actorId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Refund and reversal verified in evidence ledger.',
      result
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/sessions/:id/validate-wallet
 */
exports.validateWallet = async (req, res) => {
  try {
    const { booking_id, amount } = req.body || {};
    const result = await verifyWalletAndSettlement(supabase, {
      sessionId: req.params.id,
      bookingId: booking_id,
      amount,
      actorId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Wallet split verified in evidence ledger.',
      result
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/admin/finance/launch/status
 * GET /api/admin/finance/launch/certification
 * GET /api/admin/finance/launch-certification
 * POST /api/admin/finance/launch-certification/evaluate
 */
exports.getLaunchStatus = async (req, res) => {
  try {
    const sessionId = req.query.session_id || req.body?.session_id || null;
    const cert = await evaluateLaunchCertification(supabase, sessionId, req.user?.id);
    return res.json(cert);
  } catch (err) {
    console.error('LAUNCH STATUS EVALUATION ERROR:', err);
    return res.status(500).json({ message: err.message || 'Failed to evaluate launch status.' });
  }
};

/**
 * GET /api/admin/finance/canary
 */
exports.getCanaryStateEndpoint = async (req, res) => {
  try {
    return res.json({
      success: true,
      canary_state: getCanaryState()
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/canary/enable
 */
exports.enableCanaryHandler = async (req, res) => {
  try {
    const { stage, percentage, max_bookings } = req.body || {};
    const state = await enableCanary(supabase, req.user.id, {
      stage,
      percentage,
      maxBookings: max_bookings
    });

    return res.json({
      success: true,
      message: `Canary rollout enabled in stage '${state.stage}'.`,
      canary_state: state
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/canary/internal
 */
exports.canaryInternalHandler = async (req, res) => {
  try {
    const state = await transitionToInternal(supabase, req.user.id);
    return res.json({ success: true, message: 'Canary transitioned to INTERNAL stage.', canary_state: state });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/canary/limited
 */
exports.canaryLimitedHandler = async (req, res) => {
  try {
    const { stations } = req.body || {};
    const state = await transitionToLimited(supabase, req.user.id, stations);
    return res.json({ success: true, message: 'Canary transitioned to LIMITED stage.', canary_state: state });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/canary/percentage
 */
exports.canaryPercentageHandler = async (req, res) => {
  try {
    const { percentage } = req.body || {};
    const state = await transitionToPercentage(supabase, req.user.id, percentage);
    return res.json({ success: true, message: `Canary transitioned to PERCENTAGE stage (${state.percentage}%).`, canary_state: state });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/canary/public
 */
exports.canaryPublicHandler = async (req, res) => {
  try {
    const state = await transitionToPublic(supabase, req.user.id);
    return res.json({ success: true, message: 'Canary transitioned to PUBLIC stage (100% traffic).', canary_state: state });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/canary/pause
 */
exports.pauseCanaryHandler = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const state = await pauseCanary(supabase, req.user.id, reason);

    return res.json({
      success: true,
      message: 'Canary rollout paused.',
      canary_state: state
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/canary/resume
 */
exports.resumeCanaryHandler = async (req, res) => {
  try {
    const state = await resumeCanary(supabase, req.user.id);
    return res.json({
      success: true,
      message: `Canary rollout resumed in stage '${state.stage}'.`,
      canary_state: state
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/admin/finance/launch/canary/advance
 */
exports.advanceCanaryHandler = async (req, res) => {
  try {
    const state = await advanceCanaryStage(supabase, req.user.id);
    return res.json({
      success: true,
      message: `Canary rollout advanced to stage '${state.stage}'.`,
      canary_state: state
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/admin/finance/canary/metrics
 */
exports.getCanaryMetricsHandler = async (req, res) => {
  try {
    const metrics = await getCanaryMetrics(supabase);
    return res.json(metrics);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch canary metrics.' });
  }
};
