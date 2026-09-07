const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const {
  getStats,
  getPendingAssistants,
  getAssistants,
  approveAssistant,
  rejectAssistant,
  getAllBookings,
  getBookingById,
  updateBooking,
  getUsers,
  updateUser,
  deleteUser,
  getSOSAlerts,
  resolveSOS,
  cancelBookingByAdmin
} = require('../controllers/adminController');

// All routes require authentication & admin role
router.use(protect, adminOnly);

// Platform overview & stats
router.get('/stats', getStats);

// Bookings management
router.get('/bookings', getAllBookings);
router.get('/bookings/:id', getBookingById);
router.patch('/bookings/:id', updateBooking);
router.post('/bookings/:id/cancel', cancelBookingByAdmin);

// Assistant force & KYC
router.get('/pending-assistants', getPendingAssistants);
router.get('/assistants', getAssistants);
router.post('/assistants/:id/approve', approveAssistant);
router.post('/assistants/:id/reject', rejectAssistant);

// User / Passenger directory
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// SOS emergency incident command
router.get('/sos-alerts', getSOSAlerts);
router.post('/sos-alerts/:id/resolve', resolveSOS);

// Sahayak Payouts & Settlement Management (Phase 3B)
const {
  getAllPayouts,
  getAdminPayoutById,
  approvePayout,
  rejectPayout,
  markPayoutProcessing,
  markPayoutPaid,
  markPayoutFailed,
} = require('../controllers/payoutController');
const { adminPayoutLimiter } = require('../middleware/financialRateLimiter');

router.get('/payouts', getAllPayouts);
router.get('/payouts/:id', getAdminPayoutById);
router.post('/payouts/:id/approve', adminPayoutLimiter, approvePayout);
router.post('/payouts/:id/reject', adminPayoutLimiter, rejectPayout);
router.post('/payouts/:id/processing', adminPayoutLimiter, markPayoutProcessing);
router.post('/payouts/:id/paid', adminPayoutLimiter, markPayoutPaid);
router.post('/payouts/:id/failed', adminPayoutLimiter, markPayoutFailed);

// Finance & Financial Reconciliation Management (Phases 4 & 5)
const {
  getReconciliationReport,
  getBookingReconciliation,
  getAuditLogs,
  getPayoutAudit,
  getFinancialHealth,
  getPaymentRecoveryList,
  getRefundMonitoringList,
  getPayoutMonitoringList,
  getProductionReadiness
} = require('../controllers/financeController');

router.get('/finance/reconciliation', getReconciliationReport);
router.get('/finance/reconciliation/bookings/:id', getBookingReconciliation);
router.get('/finance/audit-logs', getAuditLogs);
router.get('/finance/payouts/:id/audit', getPayoutAudit);
router.get('/finance/health', getFinancialHealth);
router.get('/finance/payment-recovery', getPaymentRecoveryList);
router.get('/finance/refund-monitoring', getRefundMonitoringList);
router.get('/finance/payout-monitoring', getPayoutMonitoringList);
router.get('/finance/production-readiness', getProductionReadiness);

// Financial Incident Management (Phase 5)
const {
  getIncidents,
  getIncidentStats,
  getIncidentById,
  investigateIncident,
  resolveIncident,
  ignoreIncident
} = require('../controllers/incidentController');

router.get('/incidents', getIncidents);
router.get('/incidents/stats', getIncidentStats);
router.get('/incidents/:id', getIncidentById);
router.post('/incidents/:id/investigate', investigateIncident);
router.post('/incidents/:id/resolve', resolveIncident);
router.post('/incidents/:id/ignore', ignoreIncident);

// Live Production Validation, Canary Operations & Launch Certification (Phases 9 & 10)
const {
  getDeploymentStatus,
  createSession,
  listSessions,
  getSessionById,
  getSessionEvidenceList,
  createValidationOrder,
  validateLivePayment,
  validateWebhook,
  validateRecovery,
  validateRefund,
  validateWallet,
  getLaunchStatus,
  getCanaryStateEndpoint,
  enableCanaryHandler,
  pauseCanaryHandler,
  resumeCanaryHandler,
  advanceCanaryHandler,
  canaryInternalHandler,
  canaryLimitedHandler,
  canaryPercentageHandler,
  canaryPublicHandler,
  getCanaryMetricsHandler
} = require('../controllers/launchController');

// Production Deployment Validation (Phase 10)
router.get('/finance/deployment-status', getDeploymentStatus);

// Validation Sessions & Evidence
router.post('/finance/launch/sessions', createSession);
router.get('/finance/launch/sessions', listSessions);
router.get('/finance/launch/sessions/:id', getSessionById);
router.get('/finance/launch/sessions/:id/evidence', getSessionEvidenceList);
router.post('/finance/launch/create-validation-order', createValidationOrder);
router.post('/finance/launch/sessions/:id/validate-payment', validateLivePayment);
router.post('/finance/launch/sessions/:id/validate-webhook', validateWebhook);
router.post('/finance/launch/sessions/:id/validate-recovery', validateRecovery);
router.post('/finance/launch/sessions/:id/validate-refund', validateRefund);
router.post('/finance/launch/sessions/:id/validate-wallet', validateWallet);

// Phase 10 REST Endpoints
router.get('/finance/live-validation', listSessions);
router.post('/finance/live-validation/session', createSession);
router.post('/finance/live-validation/order', createValidationOrder);
router.post('/finance/live-validation/verify-payment', validateLivePayment);
router.get('/finance/live-validation/evidence', getSessionEvidenceList);

// Launch Certification Endpoints
router.get('/finance/launch/status', getLaunchStatus);
router.get('/finance/launch/certification', getLaunchStatus);
router.get('/finance/launch-certification', getLaunchStatus);
router.post('/finance/launch-certification/evaluate', getLaunchStatus);

// Canary Rollout Endpoints
router.get('/finance/canary', getCanaryStateEndpoint);
router.post('/finance/launch/canary/enable', enableCanaryHandler);
router.post('/finance/launch/canary/pause', pauseCanaryHandler);
router.post('/finance/launch/canary/resume', resumeCanaryHandler);
router.post('/finance/launch/canary/advance', advanceCanaryHandler);
router.post('/finance/canary/internal', canaryInternalHandler);
router.post('/finance/canary/limited', canaryLimitedHandler);
router.post('/finance/canary/percentage', canaryPercentageHandler);
router.post('/finance/canary/public', canaryPublicHandler);
router.get('/finance/canary/metrics', getCanaryMetricsHandler);

// Station Desk & Operational Support Tickets
const { getAllTickets, updateTicketStatus } = require('../controllers/supportController');
router.get('/support-tickets', getAllTickets);
router.patch('/support-tickets/:id', updateTicketStatus);

module.exports = router;