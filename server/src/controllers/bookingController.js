const supabase = require('../config/db');
const { formatBooking } = require('../utils/bookingFormatter');
const { broadcast, getIO } = require('./serviceController');
const { calculateBookingPrice } = require('../config/pricing');
const { resolveBooking } = require('../utils/bookingResolver');
const {
  isValidPaymentMethod,
  isCashPayment,
  isOnlinePayment,
  normalizePaymentMethod
} = require('../utils/paymentClassification');
const {
  createBookingRecordInDB,
  buildServiceData,
  generateBookingId
} = require('../utils/bookingCore');

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'accepted',
  'arriving',
  'in_service'
];


/*
|--------------------------------------------------------------------------
| CREATE BOOKING
|--------------------------------------------------------------------------
|
| POST /api/bookings
|
|--------------------------------------------------------------------------
*/

exports.createBooking = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }

    const { data: userExists } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!userExists) {
      return res.status(401).json({
        message: 'Your session has expired. Please log out and log in again to sync your account.'
      });
    }

    const { booking, normalizedPaymentMethod } = await createBookingRecordInDB(
      supabase,
      req.user.id,
      req.body
    );

    const formatted = formatBooking(booking, { includeOTP: true });

    // Realtime notification based on Option C rules:
    // Cash: immediately broadcast new_booking to fleet and status_update
    // Online: DO NOT broadcast new_booking until payment is completed and verified in Phase 2
    try {
      const io = getIO();
      if (io) {
        if (isCashPayment(normalizedPaymentMethod)) {
          io.emit('new_booking', formatted);
          io.emit('status_update', formatted);
        } else {
          // Unpaid online booking: only notify passenger's private room
          io.to(`booking_${booking.id}`).emit('status_update', formatted);
        }
      }
    } catch (e) {
      console.warn('Socket broadcast warning:', e.message);
    }

    return res.status(201).json(formatted);

  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('CREATE BOOKING SERVER ERROR:', error);
    return res.status(500).json({
      message: 'Server error while creating booking.'
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET MY BOOKINGS
|--------------------------------------------------------------------------
|
| GET /api/bookings/my-bookings
|
|--------------------------------------------------------------------------
*/

exports.getMyBookings = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Get passenger bookings
    |--------------------------------------------------------------------------
    */

    const {
      data: bookings,
      error
    } = await supabase
      .from('bookings')
      .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)')
      .eq(
        'passenger_id',
        req.user.id
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      );


    if (error) {
      console.error(
        'GET MY BOOKINGS ERROR:',
        error
      );

      return res.status(400).json({
        message: error.message
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Format and return — include OTP for passenger's own bookings
    |--------------------------------------------------------------------------
    */

    const result = (bookings || []).map((b) =>
      formatBooking(b, { includeOTP: true })
    );

    return res.json(result);

  } catch (error) {
    console.error(
      'GET MY BOOKINGS SERVER ERROR:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load bookings.'
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET SINGLE BOOKING
|--------------------------------------------------------------------------
|
| GET /api/bookings/:id
|
|--------------------------------------------------------------------------
*/

exports.getBookingById = async (req, res) => {
  try {

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }


    const { booking, error } = await resolveBooking(
      supabase,
      req.params.id,
      '*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)'
    );

    if (error) {
      console.error('GET BOOKING ERROR:', error);
      return res.status(400).json({ message: error.message });
    }

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }


    /*
    |--------------------------------------------------------------------------
    | Authorization
    |--------------------------------------------------------------------------
    |
    | Passenger can see own booking (incl. OTP).
    | Assigned assistant can see the booking (excl. OTP).
    | Admin can see everything (incl. OTP).
    |--------------------------------------------------------------------------
    */

    const isPassenger =
      booking.passenger_id ===
      req.user.id;

    const isAssistant =
      booking.assistant_id ===
      req.user.id;

    const isAdmin =
      req.user.role === 'admin';


    if (
      !isPassenger &&
      !isAssistant &&
      !isAdmin
    ) {
      return res.status(403).json({
        message: 'You are not authorized to view this booking.'
      });
    }


    if (booking.assistant && booking.assistant_id) {
      try {
        const { data: assistantJobs } = await supabase
          .from('bookings')
          .select('rating, booking_status')
          .eq('assistant_id', booking.assistant_id);

        if (assistantJobs) {
          const completed = assistantJobs.filter((j) => j.booking_status === 'completed');
          const rated = completed.filter((j) => j.rating);
          const avg = rated.length
            ? (rated.reduce((s, j) => s + Number(j.rating), 0) / rated.length).toFixed(1)
            : null;
          booking.assistant.completed_jobs = completed.length;
          booking.assistant.rating = avg;
        }
      } catch (err) {
        // Non-blocking assistant stats
      }
    }

    const includeOTP = isPassenger || isAdmin;

    return res.json(formatBooking(booking, { includeOTP }));

  } catch (error) {
    console.error(
      'GET BOOKING SERVER ERROR:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load booking.'
    });
  }
};


/*
|--------------------------------------------------------------------------
| CANCEL BOOKING BY PASSENGER (Phase 3A Rules & Refund Engine)
|--------------------------------------------------------------------------
|
| POST /api/bookings/:id/cancel
|
|--------------------------------------------------------------------------
*/

const { canPassengerCancel, determineRefundEligibility } = require('../utils/cancellationRules');
const { processBookingRefund } = require('../utils/refundService');
const { reverseAssistantEarning } = require('../utils/earningsService');

exports.cancelBooking = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }

    // 1. Resolve booking
    const { booking, error: findError } = await resolveBooking(supabase, req.params.id);

    if (findError) {
      return res.status(400).json({ message: findError.message });
    }

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // 2. Ownership verification
    if (booking.passenger_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'You are not authorized to cancel this booking.'
      });
    }

    // 3. Fetch authoritative payment ledger row
    let paymentRecord = null;
    try {
      const { data: pData } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false })
        .maybeSingle();
      paymentRecord = pData;
    } catch (pErr) {}

    // 4. Centralized Rule Check
    const ruleCheck = canPassengerCancel(booking, paymentRecord);
    if (!ruleCheck.allowed) {
      if (ruleCheck.isAlreadyCancelled) {
        // Idempotent acknowledgement
        const formatted = formatBooking(booking, { includeOTP: false });
        return res.json({
          success: true,
          idempotent: true,
          message: 'Booking is already cancelled.',
          booking: formatted,
          ...formatted
        });
      }
      return res.status(400).json({
        success: false,
        message: ruleCheck.reason || 'This booking cannot be cancelled.'
      });
    }

    // 5. Determine & Execute Refund (if eligible online payment)
    const refundEligibility = determineRefundEligibility(booking, paymentRecord, 'passenger');
    let refundResult = null;

    if (refundEligibility.requiresRefund && paymentRecord) {
      refundResult = await processBookingRefund(supabase, {
        booking,
        payment: paymentRecord,
        refundAmount: refundEligibility.refundAmount,
        reason: req.body?.reason || 'Cancelled by passenger',
        actorRole: 'passenger',
        actorId: req.user.id
      });
    }

    // 6. Update booking status
    const nowIso = new Date().toISOString();
    const newPaymentStatus = refundResult?.success
      ? 'refunded'
      : (isCashPayment(booking.payment_method) || paymentRecord?.status === 'pending')
        ? 'cancelled'
        : booking.payment_status;

    let { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        payment_status: newPaymentStatus,
        updated_at: nowIso
      })
      .eq('id', booking.id)
      .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)')
      .single();

    if (updateError && updateError.message?.includes('bookings_payment_status_check')) {
      console.warn('bookings_payment_status_check constraint rejected cancelled status; falling back gracefully.');
      const fallbackStatus = refundResult?.success ? 'refunded' : (booking.payment_status === 'paid' ? 'refunded' : 'failed');
      const retryResult = await supabase
        .from('bookings')
        .update({
          booking_status: 'cancelled',
          payment_status: fallbackStatus,
          updated_at: nowIso
        })
        .eq('id', booking.id)
        .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)')
        .single();

      updatedBooking = retryResult.data;
      updateError = retryResult.error;
    }

    if (updateError) {
      console.error('CANCEL BOOKING UPDATE ERROR:', updateError);
      return res.status(400).json({ message: updateError.message });
    }

    // 7. Update pending payment ledger to cancelled if not charged
    if (paymentRecord?.id && paymentRecord.status === 'pending') {
      try {
        await supabase
          .from('payments')
          .update({
            status: 'cancelled',
            updated_at: nowIso
          })
          .eq('id', paymentRecord.id);
      } catch (payCancelErr) {}
    }

    // 8. Reverse any pending assistant earnings
    await reverseAssistantEarning(supabase, booking.id, 'Passenger cancelled booking');

    // 9. Realtime Socket.IO Broadcast
    const formatted = formatBooking(updatedBooking, { includeOTP: false });
    try {
      const io = getIO();
      if (io) {
        // Notify passenger room
        io.to(`booking_${booking.id}`).emit('booking_cancelled', formatted);
        io.to(`booking_${booking.id}`).emit('status_update', formatted);

        // Notify assigned assistant directly if assigned
        if (booking.assistant_id) {
          io.to(`user_${booking.assistant_id}`).emit('booking_cancelled', formatted);
        }

        // Fleet radar cleanup: remove from all assistant screens
        io.emit('booking_cancelled', formatted);
        io.emit('status_update', formatted);
      }
    } catch (socketErr) {
      console.warn('Socket broadcast warning:', socketErr.message);
    }

    return res.json({
      success: true,
      idempotent: false,
      message: refundResult?.success
        ? `Booking cancelled successfully. Refund of ₹${refundEligibility.refundAmount} has been processed.`
        : 'Booking cancelled successfully.',
      booking: formatted,
      refund: refundResult?.refund || null,
      ...formatted
    });

  } catch (error) {
    console.error('CANCEL BOOKING SERVER ERROR:', error);
    return res.status(500).json({
      message: 'Unable to cancel booking.'
    });
  }
};


/*
|--------------------------------------------------------------------------
| RATE COMPLETED BOOKING
|--------------------------------------------------------------------------
|
| POST /api/bookings/:id/rating
|
| Body:
|
| {
|   "rating": 5
| }
|
|--------------------------------------------------------------------------
*/

exports.rateBooking = async (req, res) => {
  try {

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }


    const rating =
      Number(req.body.rating);


    /*
    |--------------------------------------------------------------------------
    | Validate rating
    |--------------------------------------------------------------------------
    */

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return res.status(400).json({
        message: 'Rating must be between 1 and 5.'
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Find booking
    |--------------------------------------------------------------------------
    */

    const { booking, error: findError } = await resolveBooking(supabase, req.params.id, 'id, passenger_id, booking_status');

    if (findError) {
      return res.status(400).json({ message: findError.message });
    }

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }


    /*
    |--------------------------------------------------------------------------
    | Verify passenger
    |--------------------------------------------------------------------------
    */

    if (
      booking.passenger_id !==
      req.user.id
    ) {
      return res.status(403).json({
        message: 'You are not authorized to rate this booking.'
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Only completed bookings can be rated
    |--------------------------------------------------------------------------
    */

    if (
      booking.booking_status !==
      'completed'
    ) {
      return res.status(400).json({
        message: 'Only completed bookings can be rated.'
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Save rating & review
    |--------------------------------------------------------------------------
    */

    const updatePayload = {
      rating,
      updated_at: new Date().toISOString()
    };
    if (req.body.review !== undefined) {
      updatePayload.review = req.body.review ? String(req.body.review).slice(0, 1000) : null;
    }

    const {
      data,
      error
    } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq(
        'id',
        booking.id
      )
      .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)')
      .single();


    if (error) {
      console.error(
        'RATE BOOKING ERROR:',
        error
      );

      return res.status(400).json({
        message: error.message
      });
    }

    const formatted = formatBooking(data, { includeOTP: true });
    broadcast(booking.id, formatted);
    if (booking.booking_id && booking.booking_id !== booking.id) {
      broadcast(booking.booking_id, formatted);
    }

    return res.json({
      message: 'Rating submitted successfully.',
      booking: formatted
    });

  } catch (error) {
    console.error(
      'RATE BOOKING SERVER ERROR:',
      error
    );

    return res.status(500).json({
      message: 'Unable to submit rating.'
    });
  }
};


/*
|--------------------------------------------------------------------------
| ADMIN - GET ALL BOOKINGS
|--------------------------------------------------------------------------
|
| GET /api/bookings
|
|--------------------------------------------------------------------------
*/

exports.getAllBookings = async (req, res) => {
  try {

    if (
      !req.user ||
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        message: 'Admin access required.'
      });
    }


    const {
      data: bookings,
      error
    } = await supabase
      .from('bookings')
      .select('*')
      .order(
        'created_at',
        {
          ascending: false
        }
      );


    if (error) {
      console.error(
        'GET ALL BOOKINGS ERROR:',
        error
      );

      return res.status(400).json({
        message: error.message
      });
    }


    return res.json(
      bookings || []
    );

  } catch (error) {
    console.error(
      'GET ALL BOOKINGS SERVER ERROR:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load bookings.'
    });
  }
};
exports.assignAssistant = async (req, res) => {
  try {
    return res.status(501).json({
      message: 'Assign assistant endpoint is not implemented yet.'
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to assign assistant.'
    });
  }
};

exports.processPayment = async (req, res) => {
  try {
    const { booking, error } = await resolveBooking(supabase, req.params.id);
    if (error || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();

    return res.json({
      message: 'Payment details retrieved. Phase 1 online payments remain in pending gateway verification.',
      booking_id: booking.id,
      payment_status: booking.payment_status,
      payment: payment || null
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to retrieve payment information.'
    });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { booking, error: findError } = await resolveBooking(supabase, req.params.id);

    if (findError || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.passenger_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to update this booking.' });
    }

    // Check if assistant is assigned
    if (booking.assistant_id || (booking.booking_status && booking.booking_status !== 'pending' && booking.booking_status !== 'created')) {
      return res.status(400).json({ message: 'Cannot edit booking after an assistant has been assigned.' });
    }

    const { coach, seat_number, berth_type, journey_date, journey_time } = req.body;
    const updateData = {};
    if (coach !== undefined) updateData.coach = coach.trim().toUpperCase();
    if (seat_number !== undefined) updateData.seat_number = seat_number.trim().toUpperCase();
    if (berth_type !== undefined) updateData.berth_type = berth_type;
    if (journey_date !== undefined) updateData.journey_date = journey_date;
    if (journey_time !== undefined) updateData.journey_time = journey_time;

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking.id)
      .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)')
      .single();

    if (updateError) {
      return res.status(400).json({ message: updateError.message });
    }

    const formatted = formatBooking(updated, { includeOTP: true });
    try {
      const io = getIO();
      if (io) io.emit('status_update', formatted);
    } catch (e) { }

    return res.json(formatted);
  } catch (error) {
    console.error('UPDATE BOOKING ERROR:', error);
    return res.status(500).json({ message: 'Server error while updating booking.' });
  }
};