/**
 * server/src/routes/assistantPayoutRoutes.js
 *
 * Assistant Wallet & Payout Routes (Phase 3B)
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getWallet,
  getEarnings,
  getMyPayouts,
  getPayoutById,
  requestPayout,
  cancelPayout,
} = require('../controllers/payoutController');

const { payoutRequestLimiter } = require('../middleware/financialRateLimiter');

// All assistant wallet & payout endpoints require authenticated assistant
router.use(protect);

// Wallet queries
router.get('/wallet', getWallet);
router.get('/wallet/earnings', getEarnings);

// Payout operations
router.get('/payouts', getMyPayouts);
router.get('/payouts/:id', getPayoutById);
router.post('/payouts/request', payoutRequestLimiter, requestPayout);
router.post('/payouts/:id/cancel', payoutRequestLimiter, cancelPayout);

// Direct root aliases for specific mount points
router.get('/', getMyPayouts);
router.post('/request', payoutRequestLimiter, requestPayout);
router.post('/:id/cancel', payoutRequestLimiter, cancelPayout);
router.get('/:id', getPayoutById);

module.exports = router;
