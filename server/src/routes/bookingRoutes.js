const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    createBooking,
    getMyBookings,
    getBookingById,
    cancelBooking,
    assignAssistant,
    processPayment,
    updateBooking,
    rateBooking
} = require('../controllers/bookingController');

const { bookingCancellationLimiter } = require('../middleware/financialRateLimiter');

router.post('/', protect, createBooking);
router.get('/my-bookings', protect, getMyBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id', protect, updateBooking);
router.post('/:id/cancel', bookingCancellationLimiter, protect, cancelBooking);

// ONECOOLIE Backend Pipeline Routes
router.put('/:id/assign', protect, assignAssistant);
router.put('/:id/pay', protect, processPayment);
router.post('/:id/rating', protect, rateBooking);
router.post('/:id/rate', protect, rateBooking);

module.exports = router;