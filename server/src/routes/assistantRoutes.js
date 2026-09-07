const express = require('express');

const router = express.Router();

const { protect } = require('../middleware/authMiddleware');

const {
  setAvailability,
  getMe,
  getAvailableBookings,
  acceptBooking,
  getMyJobs,
  completeBooking,
  cancelByAssistant,
  getOnlineAssistants
} = require('../controllers/assistantController');

// Assistant profile
router.get('/me', protect, getMe);

// Assistant availability
router.post('/availability', protect, setAvailability);

// Online assistants
router.get('/online', protect, getOnlineAssistants);

// Available passenger requests
router.get('/available', protect, getAvailableBookings);

// Assistant's assigned jobs
router.get('/my-jobs', protect, getMyJobs);

// Accept passenger booking
router.post('/:booking_id/accept', protect, acceptBooking);

// Cancel assigned booking
router.post('/:booking_id/cancel', protect, cancelByAssistant);

// Complete booking
router.post('/:booking_id/complete', protect, completeBooking);

// Support & Operational Issue Tickets
const { createTicket, getAssistantTickets } = require('../controllers/supportController');
router.get('/support-tickets', protect, getAssistantTickets);
router.post('/support-tickets', protect, createTicket);

module.exports = router;