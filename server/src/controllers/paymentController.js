/**
 * server/src/controllers/paymentController.js
 *
 * Dedicated Payment Controller for ONECOOLIE
 *
 * Phase 1: Authoritative pricing & payment ledgers
 * Phase 1.5: Option C Hybrid flow enforcement
 * Phase 2A: Razorpay backend order creation & idempotency
 */

const supabase = require('../config/db');
const { resolveBooking } = require('../utils/bookingResolver');
const { calculateBookingPrice } = require('../config/pricing');
const {
  isRazorpayConfigured,
  getRazorpayClient,
  formatRazorpayAmount
} = require('../config/razorpay');
const {
  isOnlinePayment,
  isCashPayment,
  normalizePaymentMethod
} = require('../utils/paymentClassification');
const crypto = require('crypto');
const { formatBooking } = require('../utils/bookingFormatter');
const {
  createBookingRecordInDB,
  normalizeBookingPayload
} = require('../utils/bookingCore');

/**
 * GET /api/payments/preview
 * Previews authoritative price calculation for selected services.
 */
exports.previewPrice = async (req, res) => {
  try {
    const { services } = req.body;
    if (!services) {
      return res.status(400).json({ message: 'Services payload is required.' });
    }
    const pricing = calculateBookingPrice(services);
    return res.json(pricing);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to calculate price.' });
  }
};

/**
 * POST /api/payments/create-order
 *
 * Securely creates a ONECOOLIE online booking and initiates a Razorpay gateway order.
 * Strictly enforces Option C rules:
 * - Rejects cash bookings (cash uses POST /api/bookings)
 * - Enforces authoritative price calculation (ignores client total_price/amount)
 * - Quarantines the booking as pending without broadcasting to assistants
 * - Converts amount to integer paise
 * - Saves gateway_order_id in payments table
 * - Safe response with razorpay public key_id and order_id (never secret)
 */
exports.createOrder = async (req, res) => {
  try {
    // 1. Authenticate passenger
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        stage: 'AUTHENTICATION_FAILURE',
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
        success: false,
        stage: 'AUTHENTICATION_FAILURE',
        message: 'Your session has expired. Please log out and log in again to sync your account.'
      });
    }

    const normalizedMethod = normalizePaymentMethod(req.body.payment_method);

    // 2. Reject cash bookings from Razorpay order creation
    if (isCashPayment(normalizedMethod)) {
      return res.status(400).json({
        success: false,
        stage: 'PAYMENT_METHOD_REJECTED',
        message: 'Cash bookings do not require a Razorpay order. Use POST /api/bookings.'
      });
    }

    // 3. Ensure payment method is online
    if (!isOnlinePayment(normalizedMethod)) {
      return res.status(400).json({
        success: false,
        stage: 'PAYMENT_METHOD_REJECTED',
        message: 'Invalid payment method for online payment order. Allowed methods: upi, online, card, netbanking.'
      });
    }

    // 4. Check Razorpay Gateway configuration
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        stage: 'RAZORPAY_CONFIGURATION_FAILURE',
        message: 'Razorpay payment gateway is not configured on this server. Please contact support or select Cash on Service.'
      });
    }

    // 5. Idempotency Check: prevent duplicate active orders for the same passenger/trip within 15 minutes
    const normalizedPayload = normalizeBookingPayload(req.body);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    if (normalizedPayload.train_no && normalizedPayload.journey_date && normalizedPayload.station_code) {
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, booking_id, train_number, station_code, journey_date, total_price, payment_status, booking_status, payment_id')
        .eq('passenger_id', req.user.id)
        .eq('train_number', String(normalizedPayload.train_no))
        .eq('journey_date', String(normalizedPayload.journey_date))
        .eq('station_code', String(normalizedPayload.station_code))
        .eq('booking_status', 'pending')
        .eq('payment_status', 'pending')
        .gte('created_at', fifteenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingBookings && existingBookings.length > 0) {
        const existingBooking = existingBookings[0];
        // Check if an existing payment record with a valid Razorpay order already exists
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('*')
          .eq('booking_id', existingBooking.id)
          .not('gateway_order_id', 'is', null)
          .maybeSingle();

        if (existingPayment && existingPayment.gateway_order_id) {
          // Return existing active order to ensure idempotency
          return res.json({
            success: true,
            booking: {
              id: existingBooking.id,
              booking_id: existingBooking.booking_id,
              train_number: existingBooking.train_number,
              station_code: existingBooking.station_code,
              journey_date: existingBooking.journey_date,
              total_price: existingBooking.total_price
            },
            payment: {
              id: existingPayment.id,
              amount: existingPayment.amount,
              currency: existingPayment.currency,
              status: existingPayment.status
            },
            razorpay: {
              key_id: process.env.RAZORPAY_KEY_ID,
              order_id: existingPayment.gateway_order_id,
              amount: formatRazorpayAmount(existingPayment.amount),
              currency: existingPayment.currency || 'INR'
            },
            idempotent: true
          });
        }
      }
    }

    // 6. Create ONECOOLIE booking and initial payment ledger record
    let bookingRecordResult;
    try {
      bookingRecordResult = await createBookingRecordInDB(supabase, req.user.id, req.body);
    } catch (dbErr) {
      console.error('DATABASE_FAILURE_CREATE_BOOKING:', dbErr.message || dbErr);
      return res.status(dbErr.status || 500).json({
        success: false,
        stage: 'DATABASE_FAILURE',
        message: dbErr.message || 'Database failure initializing booking record.'
      });
    }

    const { booking, paymentRecord, pricingResult } = bookingRecordResult;

    // 7. Calculate Razorpay amount in integer paise
    let amountInPaise;
    try {
      amountInPaise = formatRazorpayAmount(pricingResult.total);
      if (!Number.isInteger(amountInPaise) || amountInPaise < 100) {
        throw new Error(`Amount must be an integer of at least 100 paise. Calculated: ${amountInPaise}`);
      }
    } catch (pricingErr) {
      console.error('PRICING_FAILURE:', pricingErr.message);
      return res.status(400).json({
        success: false,
        stage: 'PRICING_FAILURE',
        message: pricingErr.message || 'Invalid booking amount for online payment.'
      });
    }

    // 8. Create Razorpay order via official SDK
    const razorpay = getRazorpayClient();
    let razorpayOrder;

    try {
      razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: String(booking.booking_id || '').slice(0, 40),
        notes: {
          booking_id: String(booking.id || ''),
          passenger_id: String(req.user.id || ''),
          payment_id: String(paymentRecord?.id || '')
        }
      });
    } catch (razorpayErr) {
      const rzpStatus = razorpayErr?.statusCode || razorpayErr?.status || 502;
      const rzpDesc =
        razorpayErr?.error?.description ||
        razorpayErr?.description ||
        razorpayErr?.error?.message ||
        razorpayErr?.message ||
        'Gateway order initialization failed';
      const rzpCode = razorpayErr?.error?.code || 'RAZORPAY_GATEWAY_ERROR';

      // Safe structured server log without credentials
      console.error('RAZORPAY_ORDER_CREATION_FAILURE DETAILS:', {
        stage: 'RAZORPAY_ORDER_CREATION_FAILURE',
        statusCode: rzpStatus,
        code: rzpCode,
        description: rzpDesc,
        booking_id: booking?.id,
        amount_paise: amountInPaise,
        hasKeyId: Boolean(process.env.RAZORPAY_KEY_ID),
        keyPrefix: process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 8)}...` : 'NONE',
        hasSecret: Boolean(process.env.RAZORPAY_KEY_SECRET)
      });

      // Safe rollback on failure: mark payment as failed and booking as cancelled
      if (paymentRecord?.id) {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_reason: `Gateway error: ${rzpDesc}`
          })
          .eq('id', paymentRecord.id);
      }
      await supabase
        .from('bookings')
        .update({
          booking_status: 'cancelled',
          payment_status: 'failed'
        })
        .eq('id', booking.id);

      return res.status(502).json({
        success: false,
        stage: 'RAZORPAY_ORDER_CREATION_FAILURE',
        code: rzpCode,
        gateway_reason: rzpDesc,
        message: 'Unable to initialize online payment order with gateway. Please try again or select Cash on Service.'
      });
    }

    // 9. Update ONECOOLIE payment record with gateway order details
    try {
      if (paymentRecord?.id) {
        const { error: updateErr } = await supabase
          .from('payments')
          .update({
            payment_gateway: 'razorpay',
            gateway_order_id: razorpayOrder.id,
            status: 'pending',
            metadata: {
              ...(paymentRecord.metadata || {}),
              razorpay_order_id: razorpayOrder.id,
              razorpay_amount: razorpayOrder.amount,
              razorpay_created_at: razorpayOrder.created_at
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentRecord.id);

        if (updateErr) {
          console.error('PAYMENT UPDATE ORDER ID ERROR:', updateErr);
        }
      }
    } catch (dbErr) {
      console.error('PAYMENT LEDGER GATEWAY UPDATE ERROR:', dbErr.message);
    }

    // 10. Return safe response for frontend checkout (never expose secret)
    return res.status(201).json({
      success: true,
      booking: {
        id: booking.id,
        booking_id: booking.booking_id,
        train_number: booking.train_number,
        train_name: booking.train_name,
        station_code: booking.station_code,
        journey_date: booking.journey_date,
        total_price: pricingResult.total
      },
      payment: {
        id: paymentRecord?.id || null,
        amount: pricingResult.total,
        currency: 'INR',
        status: 'pending'
      },
      razorpay: {
        key_id: process.env.RAZORPAY_KEY_ID,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      }
    });

  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('CREATE ORDER SERVER ERROR:', error);
    return res.status(500).json({
      message: 'Server error while creating payment order.'
    });
  }
};

/**
 * Common Idempotent Payment Finalization Engine (Phase 2C)
 *
 * Shared authoritative finalization function called by BOTH:
 * 1. Frontend HMAC Verification (POST /api/payments/verify)
 * 2. Razorpay Server Webhook (POST /api/payments/webhook)
 *
 * Guarantees:
 * - payments.status = 'paid'
 * - bookings.payment_status = 'paid'
 * - Booking remains booking_status = 'pending', assistant_id = null
 * - notifyPaymentVerified(booking) called EXACTLY ONCE
 * - Socket.IO new_booking emitted EXACTLY ONCE
 * - Fully idempotent: subsequent calls return existing state without duplicate broadcasts
 */
async function finalizeVerifiedRazorpayPayment(supabaseClient, {
  bookingId = null,
  orderId = null,
  paymentId = null,
  signature = null,
  eventSource = 'frontend',
  metadata = {}
}) {
  const nowIso = new Date().toISOString();

  // 1. Locate payment record using trusted gateway order ID, payment ID, or booking ID
  let paymentRecord = null;
  if (orderId) {
    const { data } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('gateway_order_id', orderId)
      .maybeSingle();
    paymentRecord = data;
  }

  if (!paymentRecord && bookingId) {
    const { data } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();
    paymentRecord = data;
  }

  if (!paymentRecord && paymentId) {
    const { data } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('gateway_payment_id', paymentId)
      .maybeSingle();
    paymentRecord = data;
  }

  // 2. Fetch associated booking
  const resolvedBookingId = bookingId || paymentRecord?.booking_id;
  if (!resolvedBookingId) {
    return {
      success: false,
      code: 'PAYMENT_NOT_FOUND',
      message: 'Payment ledger entry not found for gateway order.'
    };
  }

  const { booking, error: bFetchErr } = await resolveBooking(supabaseClient, resolvedBookingId);
  if (bFetchErr || !booking) {
    return {
      success: false,
      code: 'BOOKING_NOT_FOUND',
      message: 'Associated booking could not be located.'
    };
  }

  // 3. IDEMPOTENCY CHECK:
  // If payment or booking is already paid, acknowledge safely WITHOUT duplicate broadcasts or writes
  if (paymentRecord?.status === 'paid' || booking.payment_status === 'paid') {
    return {
      success: true,
      idempotent: true,
      message: 'Payment already verified and finalized.',
      payment: paymentRecord,
      booking
    };
  }

  // 4. ATOMIC TRANSITION TO PAID:
  let updatedPayment = paymentRecord;
  if (paymentRecord?.id) {
    const { data: pData, error: pUpdateErr } = await supabaseClient
      .from('payments')
      .update({
        status: 'paid',
        payment_gateway: 'razorpay',
        gateway_order_id: orderId || paymentRecord.gateway_order_id,
        gateway_payment_id: paymentId || paymentRecord.gateway_payment_id,
        gateway_signature: signature || paymentRecord.gateway_signature,
        metadata: {
          ...(paymentRecord.metadata || {}),
          ...(metadata || {}),
          finalized_by: eventSource,
          finalized_at: nowIso
        },
        updated_at: nowIso
      })
      .eq('id', paymentRecord.id)
      .select()
      .maybeSingle();

    if (pUpdateErr) {
      console.error('PAYMENT TABLE FINALIZATION UPDATE ERROR:', pUpdateErr);
    } else {
      updatedPayment = pData;
    }
  }

  // 5. Update booking payment_status to 'paid' (booking_status stays 'pending', assistant_id = null)
  const { data: updatedBooking, error: bUpdateErr } = await supabaseClient
    .from('bookings')
    .update({
      payment_status: 'paid',
      payment_method: paymentRecord?.payment_method || booking.payment_method || 'upi',
      payment_id: updatedPayment?.id || booking.payment_id,
      updated_at: nowIso
    })
    .eq('id', booking.id)
    .select('*, passenger:passenger_id(id, name, email, phone)')
    .single();

  if (bUpdateErr) {
    console.error('BOOKING FINALIZATION UPDATE ERROR:', bUpdateErr);
    return {
      success: false,
      code: 'BOOKING_UPDATE_FAILED',
      message: 'Failed to update booking status to paid.'
    };
  }

  // 6. OPTION C GATE OPENING (EXACTLY ONCE):
  // Online payment verified! Booking is now available for the assistant fleet radar.
  exports.notifyPaymentVerified(updatedBooking || booking);

  return {
    success: true,
    idempotent: false,
    message: 'Payment verified and finalized successfully.',
    payment: updatedPayment,
    booking: updatedBooking || booking
  };
}

exports.finalizeVerifiedRazorpayPayment = finalizeVerifiedRazorpayPayment;

/**
 * POST /api/payments/verify
 *
 * Verifies the Razorpay HMAC-SHA256 signature for an online booking payment.
 * On valid signature:
 * - Delegates to common idempotent finalizeVerifiedRazorpayPayment engine
 * - Returns success and formatted booking
 */
exports.verifyPayment = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const {
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        message: 'Missing verification parameters. Required: booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature.'
      });
    }

    const { booking, error: resolveErr } = await resolveBooking(supabase, booking_id);
    if (resolveErr || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Ensure authorization (passenger who owns the booking or admin)
    if (req.user.role !== 'admin' && booking.passenger_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to verify payment for this booking.' });
    }

    // Secret validation
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({
        message: 'Gateway secret is not configured on the server.'
      });
    }

    // Compute expected HMAC-SHA256 signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    let isSignatureValid = false;
    try {
      const generatedBuffer = Buffer.from(generated_signature, 'utf8');
      const clientBuffer = Buffer.from(razorpay_signature, 'utf8');
      if (generatedBuffer.length === clientBuffer.length) {
        isSignatureValid = crypto.timingSafeEqual(generatedBuffer, clientBuffer);
      }
    } catch (cmpErr) {
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      // Record failure on payment record
      try {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_reason: 'HMAC signature verification failed',
            gateway_order_id: razorpay_order_id,
            gateway_payment_id: razorpay_payment_id,
            updated_at: new Date().toISOString()
          })
          .eq('booking_id', booking.id);
      } catch (logErr) {}

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid signature.'
      });
    }

    // Delegate to common idempotent payment finalizer
    const finalResult = await finalizeVerifiedRazorpayPayment(supabase, {
      bookingId: booking.id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      eventSource: 'frontend'
    });

    if (!finalResult.success) {
      return res.status(500).json({ message: finalResult.message || 'Payment finalization failed.' });
    }

    const formatted = formatBooking(finalResult.booking, { includeOTP: true });

    return res.json({
      success: true,
      message: finalResult.idempotent
        ? 'Payment already verified.'
        : 'Payment verified successfully. Booking is now available for station assistants.',
      booking: formatted,
      payment: finalResult.payment || null,
      idempotent: finalResult.idempotent
    });

  } catch (err) {
    console.error('VERIFY PAYMENT SERVER ERROR:', err);
    return res.status(500).json({
      message: 'Server error during payment verification.'
    });
  }
};

/**
 * POST /api/payments/webhook
 *
 * Razorpay Server-to-Server Webhook Endpoint (Phase 2C)
 *
 * Requirements:
 * - Public route (No JWT auth - Razorpay calls this server-to-server)
 * - Authenticated strictly via Razorpay HMAC-SHA256 signature verification over the exact raw body
 * - Uses process.env.RAZORPAY_WEBHOOK_SECRET
 * - Constant-time comparison with crypto.timingSafeEqual
 * - Handles payment.captured, order.paid, payment.failed
 * - Calls common finalizeVerifiedRazorpayPayment() on payment success
 * - Prevents duplicate processing via database audit table (payment_webhook_events)
 * - Prevents late payment failures from downgrading already-paid bookings
 * - Safely returns HTTP 200 on valid acknowledgement
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing Razorpay webhook signature header.'
      });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay webhook secret is not configured on the server.'
      });
    }

    // 1. Extract raw byte buffer
    let rawBody = req.body;
    if (Buffer.isBuffer(rawBody)) {
      // Direct Buffer from express.raw()
    } else if (typeof rawBody === 'string') {
      rawBody = Buffer.from(rawBody, 'utf8');
    } else if (rawBody && typeof rawBody === 'object') {
      rawBody = Buffer.from(JSON.stringify(rawBody), 'utf8');
    } else {
      rawBody = Buffer.from('', 'utf8');
    }

    // 2. Compute expected HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // 3. Constant-time comparison to prevent timing attacks
    let isSignatureValid = false;
    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const clientBuffer = Buffer.from(String(signature).trim(), 'utf8');
      if (expectedBuffer.length === clientBuffer.length) {
        isSignatureValid = crypto.timingSafeEqual(expectedBuffer, clientBuffer);
      }
    } catch (cmpErr) {
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Razorpay webhook signature.'
      });
    }

    // 4. Parse verified event JSON payload
    let eventData;
    try {
      eventData = JSON.parse(rawBody.toString('utf8'));
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: 'Malformed webhook JSON payload.'
      });
    }

    const eventType = eventData.event;
    const eventId = req.headers['x-razorpay-event-id'] || eventData.event_id || eventData.id || null;

    // 5. Deduplication check via payment_webhook_events
    if (eventId) {
      try {
        const { data: existingEvent } = await supabase
          .from('payment_webhook_events')
          .select('id, status')
          .eq('gateway_event_id', eventId)
          .maybeSingle();

        if (existingEvent && existingEvent.status === 'processed') {
          return res.status(200).json({
            status: 'ok',
            message: 'Webhook event already processed.',
            idempotent: true
          });
        }
      } catch (auditLookupErr) {
        // Continue if table doesn't exist yet in dev
      }
    }

    // 6. Handle Supported Events
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = eventData.payload?.payment?.entity || {};
      const orderEntity = eventData.payload?.order?.entity || {};
      const orderId = paymentEntity.order_id || orderEntity.id || null;
      const paymentId = paymentEntity.id || null;

      if (!orderId && !paymentId) {
        return res.status(200).json({
          status: 'ok',
          message: 'No payment or order identifiers in payload.'
        });
      }

      // Delegate to common finalizer
      const finalResult = await finalizeVerifiedRazorpayPayment(supabase, {
        orderId,
        paymentId,
        eventSource: 'webhook',
        metadata: {
          event_id: eventId,
          event_type: eventType,
          method: paymentEntity.method
        }
      });

      // Record audit record
      try {
        await supabase.from('payment_webhook_events').insert({
          gateway: 'razorpay',
          event_type: eventType,
          gateway_event_id: eventId,
          payment_id: finalResult.payment?.id || null,
          booking_id: finalResult.booking?.id || null,
          status: 'processed',
          payload: eventData
        });
      } catch (auditInsertErr) {}

      return res.status(200).json({
        status: 'ok',
        message: finalResult.idempotent ? 'Payment already finalized.' : 'Payment finalized successfully via webhook.',
        idempotent: finalResult.idempotent
      });
    }

    if (eventType === 'payment.failed') {
      const paymentEntity = eventData.payload?.payment?.entity || {};
      const orderId = paymentEntity.order_id || null;
      const paymentId = paymentEntity.id || null;
      const errorReason = paymentEntity.error_description || paymentEntity.error_reason || 'Payment failed at gateway';

      // Locate payment record
      let paymentRecord = null;
      if (orderId) {
        const { data } = await supabase
          .from('payments')
          .select('*')
          .eq('gateway_order_id', orderId)
          .maybeSingle();
        paymentRecord = data;
      }
      if (!paymentRecord && paymentId) {
        const { data } = await supabase
          .from('payments')
          .select('*')
          .eq('gateway_payment_id', paymentId)
          .maybeSingle();
        paymentRecord = data;
      }

      if (paymentRecord) {
        // CRITICAL LATE FAILURE GUARD:
        // Never allow a late failure event to downgrade an already paid payment!
        if (paymentRecord.status === 'paid') {
          console.warn(`[WEBHOOK] Late payment.failed received for already-paid payment ${paymentRecord.id}. Preserving PAID status.`);

          try {
            await supabase.from('payment_webhook_events').insert({
              gateway: 'razorpay',
              event_type: eventType,
              gateway_event_id: eventId,
              payment_id: paymentRecord.id,
              booking_id: paymentRecord.booking_id,
              status: 'ignored',
              error_message: 'Ignored late failure event on already-paid payment'
            });
          } catch (auditErr) {}

          return res.status(200).json({
            status: 'ok',
            message: 'Payment is already paid. Late failure event ignored.'
          });
        }

        // Mark payment as failed
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_reason: String(errorReason).slice(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentRecord.id);
      }

      try {
        await supabase.from('payment_webhook_events').insert({
          gateway: 'razorpay',
          event_type: eventType,
          gateway_event_id: eventId,
          payment_id: paymentRecord?.id || null,
          booking_id: paymentRecord?.booking_id || null,
          status: 'processed',
          error_message: errorReason
        });
      } catch (auditErr) {}

      return res.status(200).json({
        status: 'ok',
        message: 'Payment failure recorded.'
      });
    }

    // Safely acknowledge any other webhook events (e.g. refunds, settlement notices)
    return res.status(200).json({
      status: 'ok',
      message: `Webhook event ${eventType} acknowledged.`
    });

  } catch (err) {
    console.error('HANDLE WEBHOOK SERVER ERROR:', err);
    return res.status(500).json({
      message: 'Server error processing webhook event.'
    });
  }
};

/**
 * GET /api/payments/:bookingId/status
 *
 * Dedicated Payment Recovery & Status Endpoint (Phase 2C)
 *
 * Requirements:
 * - JWT protected
 * - Passenger can access only their own booking
 * - Assigned assistant or admin can access
 * - Unrelated passengers or assistants receive 403 Forbidden
 * - Returns only safe public fields (never secrets or signatures)
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { bookingId } = req.params;
    const { booking, error: resolveErr } = await resolveBooking(supabase, bookingId);

    if (resolveErr || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Ownership & Authorization Check
    const isOwner = booking.passenger_id === req.user.id;
    const isAssignedAssistant = booking.assistant_id && booking.assistant_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedAssistant && !isAdmin) {
      return res.status(403).json({
        message: 'Not authorized to view payment status for this booking.'
      });
    }

    // Fetch authoritative payment ledger row
    const { data: payment } = await supabase
      .from('payments')
      .select('id, amount, currency, payment_method, payment_gateway, gateway_order_id, status, failure_reason, created_at, updated_at')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false })
      .maybeSingle();

    return res.json({
      success: true,
      booking_id: booking.booking_id,
      booking_uuid: booking.id,
      payment_status: payment ? payment.status : booking.payment_status,
      payment_method: payment ? payment.payment_method : booking.payment_method,
      amount: payment ? Number(payment.amount) : Number(booking.total_price),
      currency: payment ? payment.currency : 'INR',
      booking_status: booking.booking_status,
      gateway_order_id: payment?.gateway_order_id || null,
      failure_reason: payment?.failure_reason || null
    });

  } catch (err) {
    console.error('GET PAYMENT STATUS ERROR:', err);
    return res.status(500).json({
      message: 'Server error retrieving payment status.'
    });
  }
};

/**
 * GET /api/payments/:bookingId/refunds
 *
 * Retrieves the refund ledger records for a given booking (Phase 3A)
 *
 * Protected: Owner passenger, assigned assistant, or admin.
 */
exports.getBookingRefunds = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { bookingId } = req.params;
    const { booking, error: resolveErr } = await resolveBooking(supabase, bookingId);

    if (resolveErr || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Ownership & Authorization Check
    const isOwner = booking.passenger_id === req.user.id;
    const isAssignedAssistant = booking.assistant_id && booking.assistant_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedAssistant && !isAdmin) {
      return res.status(403).json({
        message: 'Not authorized to view refund details for this booking.'
      });
    }

    let refunds = [];
    try {
      const { data: refundRows, error: rErr } = await supabase
        .from('refunds')
        .select('id, amount, currency, status, reason, failure_reason, created_at, processed_at')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false });

      if (!rErr && refundRows) {
        refunds = refundRows;
      }
    } catch (refErr) {}

    const totalRefunded = refunds
      .filter((r) => r.status === 'processed')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return res.json({
      success: true,
      booking_id: booking.booking_id,
      booking_uuid: booking.id,
      refunds,
      total_refunded: Math.round(totalRefunded * 100) / 100
    });

  } catch (err) {
    console.error('GET BOOKING REFUNDS ERROR:', err);
    return res.status(500).json({
      message: 'Server error retrieving refund records.'
    });
  }
};

/**
 * GET /api/payments/booking/:bookingId
 * Retrieves the payment record and breakdown for a given booking.
 */
exports.getPaymentByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { booking, error: resolveErr } = await resolveBooking(supabase, bookingId);

    if (resolveErr || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Authorization: Passenger who owns it, assigned assistant, or admin
    if (
      req.user.role !== 'admin' &&
      booking.passenger_id !== req.user.id &&
      booking.assistant_id !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to view this payment.' });
    }

    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (pErr) {
      return res.status(400).json({ message: pErr.message });
    }

    if (!payment) {
      // Fallback response from booking row if migration not yet applied for this record
      return res.json({
        id: booking.payment_id || null,
        booking_id: booking.id,
        amount: Number(booking.total_price) || 0,
        currency: 'INR',
        payment_method: booking.payment_method,
        status: booking.payment_status,
        created_at: booking.created_at
      });
    }

    return res.json(payment);
  } catch (err) {
    console.error('GET PAYMENT BY BOOKING ERROR:', err);
    return res.status(500).json({ message: 'Server error retrieving payment details.' });
  }
};

/**
 * GET /api/payments/:id
 * Retrieves a single payment record by payment UUID.
 */
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, booking:booking_id(id, booking_id, train_number, train_name, station_code, booking_status)')
      .eq('id', id)
      .maybeSingle();

    if (error || !payment) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    // Authorization
    if (req.user.role !== 'admin' && payment.passenger_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    return res.json(payment);
  } catch (err) {
    console.error('GET PAYMENT ERROR:', err);
    return res.status(500).json({ message: 'Server error retrieving payment record.' });
  }
};

/**
 * Phase 2 Gateway Verification Hook (Architecture Reference)
 *
 * When the real payment gateway (Razorpay/Cashfree/PhonePe) verifies an online payment in Phase 2:
 * 1. Synchronize payments.status = 'paid' and bookings.payment_status = 'paid'
 * 2. If booking is still pending assignment, broadcast 'new_booking' to all connected assistants.
 */
exports.notifyPaymentVerified = (booking) => {
  try {
    const { getIO } = require('./serviceController');
    const io = getIO();
    if (io && booking) {
      const { formatBooking } = require('../utils/bookingFormatter');
      const formatted = formatBooking(booking, { includeOTP: false });
      // Now visible on assistant fleet radar
      io.emit('new_booking', formatted);
      io.emit('status_update', formatted);
    }
  } catch (err) {
    console.warn('Phase 2 broadcast hook notice:', err.message);
  }
};


