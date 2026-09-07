const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  searchTrains,
  getLiveStationBoard,
  getSupportedStations,
  updateTrainApiKey,
  getPnrStatus,
  syncTrainsDatabase
} = require('../controllers/trainController');

// Rate limiter for live station board: 30 requests per minute per IP
const liveStationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many station board requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

// Autocomplete search
router.get('/search', searchTrains);

// Live station board
router.get('/live-station', liveStationLimiter, getLiveStationBoard);

// Supported stations list
router.get('/supported-stations', getSupportedStations);

// Update API key dynamically
router.post('/update-key', updateTrainApiKey);

// PNR Status Lookup
router.get('/pnr-status', liveStationLimiter, getPnrStatus);

// Auto-sync trains database from live railway APIs
router.post('/sync', syncTrainsDatabase);

module.exports = router;