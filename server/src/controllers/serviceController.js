const supabase = require('../config/db');
const { formatBooking } = require('../utils/bookingFormatter');
const { resolveBooking } = require('../utils/bookingResolver');
const { recordAssistantEarningOnCompletion } = require('../utils/earningsService');
const {
  isOnlinePayment,
  isCashPayment,
  normalizePaymentMethod
} = require('../utils/paymentClassification');

let io = null;

// --------------------------------------------------
// SOCKET.IO INTEGRATION
// --------------------------------------------------

exports.setIO = (ioInstance) => {
  io = ioInstance;
};

exports.getIO = () => io;

/**
 * Broadcast a status_update to both the assistant and passenger sides,
 * and globally to the operations command center (admin).
 * OTP is NEVER sent through the socket – it can only be read from the
 * passenger's own booking view (/api/bookings/:id).
 */
exports.broadcast = (bookingId, booking) => {
  if (!io || !bookingId) return;

  // Strip OTP before broadcasting
  const {
    start_otp,
    start_otp_expires_at,
    start_otp_hash,
    ...safePayload
  } = booking || {};

  // Emit to specific booking room (for active passenger & assistant)
  io.to(`booking_${bookingId}`).emit('status_update', safePayload);
  // Emit globally (for admin command center)
  io.emit('status_update', safePayload);
};

// --------------------------------------------------
// INTERNAL HELPER - fetch and validate booking
// --------------------------------------------------

async function fetchBookingForAssistant(bookingId, assistantId) {
  const { booking, error } = await resolveBooking(
    supabase,
    bookingId,
    '*, passenger:passenger_id(id, name, email, phone)'
  );

  if (error) {
    return { error: { status: 400, message: error.message } };
  }

  if (!booking) {
    return { error: { status: 404, message: 'Job not found.' } };
  }

  if (booking.assistant_id !== assistantId) {
    return { error: { status: 403, message: 'You are not assigned to this job.' } };
  }

  return { booking };
}

// --------------------------------------------------
// UPDATE BOOKING STATUS (PATCH /service/:booking_id/status)
// --------------------------------------------------
//
// Supported transitions (assistant-driven):
//
//   accepted   → arriving     (pressing "I'm Arriving")
//   in_service → completed    (via status endpoint - requires payment)
//
// OTP verification is the ONLY path from arriving → in_service.
// --------------------------------------------------

exports.updateStatus = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { status } = req.body;

    if (!booking_id || !status) {
      return res.status(400).json({ message: 'Booking ID and status are required.' });
    }

    const { booking, error: fetchError } = await fetchBookingForAssistant(
      booking_id, req.user.id
    );

    if (fetchError) {
      return res.status(fetchError.status).json({ message: fetchError.message });
    }

    const current = booking.booking_status;

    // ── accepted → arriving ────────────────────────────────────────────────
    if (current === 'accepted' && status === 'arriving') {
      if (isOnlinePayment(booking.payment_method) && booking.payment_status !== 'paid') {
        return res.status(400).json({
          message: 'Online payment must be completed and verified before arriving.'
        });
      }

      const { data, error } = await supabase
        .from('bookings')
        .update({
          booking_status: 'arriving',
          assistant_status: 'arriving',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id)
        .eq('assistant_id', req.user.id)
        .eq('booking_status', 'accepted')   // atomic guard
        .select('*, passenger:passenger_id(id, name, email, phone)')
        .single();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      if (!data) {
        return res.status(409).json({ message: 'Booking status changed by another process. Please refresh.' });
      }

      const formatted = formatBooking(data);
      exports.broadcast(booking_id, formatted);
      return res.json(formatted);
    }

    // ── in_service → completed (requires payment) ─────────────────────────
    if (current === 'in_service' && status === 'completed') {
      if (booking.payment_status !== 'paid') {
        return res.status(400).json({
          message: 'Payment must be collected before completing the service.'
        });
      }

      const { data, error } = await supabase
        .from('bookings')
        .update({
          booking_status: 'completed',
          assistant_status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id)
        .eq('assistant_id', req.user.id)
        .eq('booking_status', 'in_service') // atomic guard
        .select('*, passenger:passenger_id(id, name, email, phone)')
        .single();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      if (!data) {
        return res.status(409).json({ message: 'Booking was already completed or changed.' });
      }

      // Record assistant earning and platform commission upon completion
      await recordAssistantEarningOnCompletion(supabase, data);

      const formatted = formatBooking(data);
      exports.broadcast(booking_id, formatted);
      return res.json(formatted);
    }

    // ── Disallow direct arriving → in_service via status (must use OTP endpoint)
    if (current === 'arriving' && status === 'in_service') {
      return res.status(400).json({
        message: 'OTP verification is required to start the service. Use the confirm-otp endpoint.'
      });
    }

    // ── already completed?
    if (current === 'completed') {
      return res.status(409).json({ message: 'This job is already completed.' });
    }

    return res.status(400).json({
      message: `Invalid status transition: ${current} → ${status}`
    });

  } catch (err) {
    console.error('UPDATE STATUS ERROR:', err);
    return res.status(500).json({ message: 'Unable to update booking status.' });
  }
};

// --------------------------------------------------
// CONFIRM START OTP (POST /service/:booking_id/confirm-otp)
// --------------------------------------------------
//
// arriving → in_service
//
// Validates the 6-digit OTP the passenger shows the assistant.
// --------------------------------------------------

exports.confirmStartOTP = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { otp } = req.body;

    // ── Validate OTP format
    if (!otp) {
      return res.status(400).json({ message: 'OTP is required.' });
    }

    const cleanOtp = String(otp).trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ message: 'OTP must be exactly 6 digits.' });
    }

    // ── Fetch booking (raw, we need start_otp to compare)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, passenger:passenger_id(id, name, email, phone)')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (booking.assistant_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not assigned to this job.' });
    }

    // Option C Gate: Unpaid online bookings cannot proceed to in_service
    if (isOnlinePayment(booking.payment_method) && booking.payment_status !== 'paid') {
      return res.status(400).json({
        message: 'Online payment must be completed and verified before starting service.'
      });
    }

    // ── Must be in 'arriving' state
    if (booking.booking_status !== 'arriving') {
      return res.status(400).json({
        message: 'OTP can only be verified after arriving. Current status: ' + booking.booking_status
      });
    }

    // ── OTP must exist
    if (!booking.start_otp) {
      return res.status(400).json({
        message: 'No OTP is available for this booking. Ask the passenger to check their app.'
      });
    }

    // ── Check OTP expiry
    if (
      booking.start_otp_expires_at &&
      new Date(booking.start_otp_expires_at) < new Date()
    ) {
      return res.status(400).json({
        message: 'This OTP has expired. Please ask the passenger to check their app for a refreshed OTP.'
      });
    }

    // ── Compare OTP
    if (String(booking.start_otp) !== cleanOtp) {
      return res.status(400).json({
        message: 'Invalid OTP. Ask the passenger for the OTP shown in their app.'
      });
    }

    // ── OTP verified: transition to in_service
    const { data, error } = await supabase
      .from('bookings')
      .update({
        booking_status: 'in_service',
        assistant_status: 'in_service',
        start_otp_verified: true,
        start_otp: null,        // clear OTP after use
        start_otp_expires_at: null,
        service_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .eq('assistant_id', req.user.id)
      .eq('booking_status', 'arriving')    // atomic guard
      .select('*, passenger:passenger_id(id, name, email, phone)')
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    if (!data) {
      return res.status(409).json({ message: 'Booking status changed by another process. Please refresh.' });
    }

    const formatted = formatBooking(data);
    exports.broadcast(booking_id, formatted);

    return res.json(formatted);

  } catch (err) {
    console.error('CONFIRM OTP ERROR:', err);
    return res.status(500).json({ message: 'Unable to verify OTP.' });
  }
};

// --------------------------------------------------
// MARK PAYMENT AS PAID (POST /service/:booking_id/pay)
// --------------------------------------------------
//
// Accepts: { method: 'cash' } or { method: 'upi' }
//
// Requirements:
//   - Service must be in_service
//   - Payment cannot be recorded twice (409 on duplicate)
//   - Method must be cash or upi
// --------------------------------------------------

exports.markPaid = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { method } = req.body;

    // ── Validate method: On-spot collection by assistant is strictly cash
    if (!method) {
      return res.status(400).json({ message: 'Payment method is required.' });
    }

    const normalizedMethod = normalizePaymentMethod(method);

    if (!isCashPayment(normalizedMethod)) {
      return res.status(400).json({
        message: 'Only cash payments can be collected by the assistant on spot.'
      });
    }

    // ── Fetch and validate booking ownership
    const { booking, error: fetchError } = await fetchBookingForAssistant(
      booking_id, req.user.id
    );

    if (fetchError) {
      return res.status(fetchError.status).json({ message: fetchError.message });
    }

    // Must be a cash booking
    if (!isCashPayment(booking.payment_method)) {
      return res.status(400).json({
        message: 'This booking was booked with online payment. Payment must be verified through the online gateway.'
      });
    }

    // ── Must be in_service
    if (booking.booking_status !== 'in_service') {
      return res.status(400).json({
        message: 'Payment can only be recorded once the service has started (in_service).'
      });
    }

    // ── Reject duplicate payment
    if (booking.payment_status === 'paid') {
      return res.status(409).json({
        message: 'Payment has already been recorded for this booking.'
      });
    }

    // Update or create dedicated payment ledger entry (Phase 1)
    let paymentRecordId = booking.payment_id || null;
    try {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', booking.id)
        .maybeSingle();

      if (existingPayment) {
        paymentRecordId = existingPayment.id;
        await supabase
          .from('payments')
          .update({
            status: 'paid',
            payment_method: normalizedMethod,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPayment.id);
      } else {
        const { data: newPayment } = await supabase
          .from('payments')
          .insert([{
            booking_id: booking.id,
            passenger_id: booking.passenger_id,
            amount: Number(booking.total_price) || 0,
            currency: 'INR',
            payment_method: normalizedMethod,
            status: 'paid',
            metadata: { note: 'Payment recorded by assistant during service' }
          }])
          .select('id')
          .maybeSingle();
        if (newPayment) paymentRecordId = newPayment.id;
      }
    } catch (payLedgerErr) {
      console.warn('Payment update notice:', payLedgerErr.message);
    }

    // ── Record payment atomically on booking
    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        payment_method: normalizedMethod,
        payment_id: paymentRecordId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('assistant_id', req.user.id)
      .eq('payment_status', 'pending')  // atomic guard against double-payment
      .select('*, passenger:passenger_id(id, name, email, phone)')
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    if (!data) {
      return res.status(409).json({ message: 'Payment was already recorded (concurrent request).' });
    }

    const formatted = formatBooking(data);
    exports.broadcast(booking_id, formatted);

    return res.json(formatted);

  } catch (err) {
    console.error('MARK PAID ERROR:', err);
    return res.status(500).json({ message: 'Unable to record payment.' });
  }
};

// --------------------------------------------------
// PASSENGER RATING (POST /service/:booking_id/rate)
// --------------------------------------------------

exports.rateBooking = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { rating, review } = req.body;

    const numericRating = Number(rating);

    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, passenger_id, booking_status')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.passenger_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    if (booking.booking_status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed bookings.' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        rating: numericRating,
        review: review ? String(review).slice(0, 1000) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)')
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    if (data?.assistant && data.assistant_id) {
      try {
        const { data: assistantJobs } = await supabase
          .from('bookings')
          .select('rating, booking_status')
          .eq('assistant_id', data.assistant_id);

        if (assistantJobs) {
          const completed = assistantJobs.filter((j) => j.booking_status === 'completed');
          const rated = completed.filter((j) => j.rating);
          const avg = rated.length
            ? (rated.reduce((s, j) => s + Number(j.rating), 0) / rated.length).toFixed(1)
            : null;
          data.assistant.completed_jobs = completed.length;
          data.assistant.rating = avg;
        }
      } catch (err) {
        // Non-blocking assistant stats
      }
    }

    const formatted = formatBooking(data, { includeOTP: true });
    exports.broadcast(booking_id, formatted);

    return res.json(formatted);

  } catch (err) {
    console.error('RATE BOOKING ERROR:', err);
    return res.status(500).json({ message: 'Unable to submit rating.' });
  }
};

// --------------------------------------------------
// SOS (POST /service/:booking_id/sos)
// --------------------------------------------------

exports.triggerSOS = async (req, res) => {
  try {
    const { booking_id } = req.params;

    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('id, passenger_id, assistant_id, station_code, train_number')
      .eq('id', booking_id)
      .single();

    if (bookingError || !bookingRow) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const isPassenger = bookingRow.passenger_id === req.user.id;
    const isAssistant = bookingRow.assistant_id === req.user.id;

    if (!isPassenger && !isAssistant) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    // Update SOS in bookings table
    const { data: updatedBooking, error: updateErr } = await supabase
      .from('bookings')
      .update({
        sos_triggered: true,
        sos_triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .select('*, passenger:passenger_id(id, name, email, phone)')
      .single();

    if (updateErr) {
      console.error('SOS DB UPDATE ERROR:', updateErr);
    }

    // Insert into sos_alerts log if table exists
    await supabase
      .from('sos_alerts')
      .insert([
        {
          booking_id,
          passenger_id: bookingRow.passenger_id,
          station_code: bookingRow.station_code,
          train_no: bookingRow.train_number,
          status: 'active',
        },
      ])
      .catch(() => { });

    // Emit SOS alert via socket
    if (io) {
      io.emit('sos_alert', {
        booking_id,
        user_id: req.user.id,
        station_code: bookingRow.station_code,
        train_no: bookingRow.train_number,
      });
    }

    return res.json(formatBooking(updatedBooking || bookingRow));

  } catch (err) {
    console.error('SOS ERROR:', err);
    return res.status(500).json({ message: 'Unable to trigger SOS.' });
  }
};

// --------------------------------------------------
// GET CHAT MESSAGES (GET /service/:booking_id/chat)
// --------------------------------------------------
exports.getChatMessages = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking_id);

    let query = supabase.from('bookings').select('id, booking_id, services');
    if (isUUID) {
      query = query.eq('id', booking_id);
    } else {
      query = query.eq('booking_id', booking_id);
    }

    const { data: booking, error } = await query.maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const messages = (booking.services && Array.isArray(booking.services.chat_messages))
      ? booking.services.chat_messages
      : [];

    return res.json({ messages });
  } catch (err) {
    console.error('GET CHAT MESSAGES ERROR:', err);
    return res.status(500).json({ message: 'Unable to load chat messages.' });
  }
};

// --------------------------------------------------
// SEND CHAT MESSAGE (POST /service/:booking_id/chat)
// --------------------------------------------------
exports.sendChatMessage = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { text, from, timestamp } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required.' });
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking_id);

    let query = supabase.from('bookings').select('id, booking_id, services');
    if (isUUID) {
      query = query.eq('id', booking_id);
    } else {
      query = query.eq('booking_id', booking_id);
    }

    const { data: booking, error } = await query.maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const curServices = (booking.services && typeof booking.services === 'object') ? booking.services : {};
    const oldMsgs = Array.isArray(curServices.chat_messages) ? curServices.chat_messages : [];

    const newMessage = {
      bookingId: booking.id,
      bookingCode: booking.booking_id,
      from: from || (req.user?.role === 'assistant' ? 'assistant' : 'passenger'),
      text: String(text).trim().slice(0, 1000),
      timestamp: timestamp || new Date().toISOString(),
    };

    const updatedMessages = [...oldMsgs, newMessage];

    await supabase
      .from('bookings')
      .update({
        services: {
          ...curServices,
          chat_messages: updatedMessages,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    // Broadcast via socket to both UUID and booking code rooms
    if (io) {
      io.to(`booking_${booking.id}`).emit('chat_message', newMessage);
      if (booking.booking_id && booking.booking_id !== booking.id) {
        io.to(`booking_${booking.booking_id}`).emit('chat_message', newMessage);
      }
    }

    return res.json({ success: true, message: newMessage, messages: updatedMessages });
  } catch (err) {
    console.error('SEND CHAT MESSAGE ERROR:', err);
    return res.status(500).json({ message: 'Unable to send message.' });
  }
};