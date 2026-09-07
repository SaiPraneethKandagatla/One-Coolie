/**
 * server/src/routes/assistantWalletRoutes.js
 *
 * Dedicated Assistant Wallet Routes (Phase 3B)
 * Mounted at: /api/assistant-wallet
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getWallet, getEarnings } = require('../controllers/payoutController');

router.use(protect);

router.get('/', getWallet);
router.get('/earnings', getEarnings);

module.exports = router;
