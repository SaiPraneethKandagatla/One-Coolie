const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');

const {
  updateStatus,
  confirmStartOTP,
  markPaid,
  rateBooking,
  triggerSOS,
  getChatMessages,
  sendChatMessage
} = require('../controllers/serviceController');

router.patch(
  '/:booking_id/status',
  protect,
  updateStatus
);

router.post(
  '/:booking_id/confirm-otp',
  protect,
  confirmStartOTP
);

router.post(
  '/:booking_id/pay',
  protect,
  markPaid
);

router.post(
  '/:booking_id/rate',
  protect,
  rateBooking
);

router.post(
  '/:booking_id/sos',
  protect,
  triggerSOS
);

router.get(
  '/:booking_id/chat',
  protect,
  getChatMessages
);

router.post(
  '/:booking_id/chat',
  protect,
  sendChatMessage
);

module.exports = router;