/**
 * server/src/routes/paymentRoutes.js
 *
 * Dedicated Payment Routes for ONECOOLIE
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  previewPrice,
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
  getBookingRefunds,
  getPaymentByBookingId,
  getPaymentById
} = require('../controllers/paymentController');

const { paymentOrderLimiter, paymentVerifyLimiter } = require('../middleware/financialRateLimiter');

// Public or protected preview of service price
router.post('/preview', previewPrice);

// Public Razorpay Webhook Endpoint (Phase 2C: Authenticated strictly via Razorpay HMAC signature, zero rate limit)
router.post('/webhook', handleWebhook);

// Protected Razorpay order creation (Phase 2A & 5)
router.post('/create-order', paymentOrderLimiter, protect, createOrder);

// Protected Razorpay payment verification (Phase 2B/2C & 5)
router.post('/verify', paymentVerifyLimiter, protect, verifyPayment);

// Protected payment recovery & status check (Phase 2C)
router.get('/:bookingId/status', protect, getPaymentStatus);
router.get('/booking/:bookingId/status', protect, getPaymentStatus);

// Protected refund lookup (Phase 3A)
router.get('/:bookingId/refunds', protect, getBookingRefunds);
router.get('/booking/:bookingId/refunds', protect, getBookingRefunds);

// Protected payment lookups
router.get('/booking/:bookingId', protect, getPaymentByBookingId);
router.get('/:id', protect, getPaymentById);

module.exports = router;
