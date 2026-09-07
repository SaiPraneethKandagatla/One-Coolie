const supabase = require('../config/db');
const { formatBooking } = require('../utils/bookingFormatter');
const { broadcast } = require('./serviceController');
const { resolveBooking } = require('../utils/bookingResolver');
const { PLATFORM_COMMISSION_PERCENT } = require('../config/commission');
const { recordAssistantEarningOnCompletion } = require('../utils/earningsService');

// --------------------------------------------------
// PLATFORM STATS & METRICS (GET /admin/stats)
// --------------------------------------------------
exports.getStats = async (req, res) => {
  try {
    // 1. Fetch bookings summary
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, total_price, payment_status, payment_method, booking_status, station_code, sos_triggered, created_at');

    if (bErr) throw bErr;

    // 2. Fetch users summary
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id, role, is_approved, is_online');

    if (uErr) throw uErr;

    const allBookings = bookings || [];
    const allUsers = users || [];

    const totalBookings = allBookings.length;
    const pendingAssistants = allUsers.filter(u => u.role === 'assistant' && !u.is_approved).length;
    const totalAssistants = allUsers.filter(u => u.role === 'assistant').length;
    const onlineAssistants = allUsers.filter(u => u.role === 'assistant' && u.is_online).length;
    const totalPassengers = allUsers.filter(u => u.role === 'passenger').length;

    // Revenue calculations (Phase 1 Platform Commission & Sahayak Split)
    const grossRevenue = allBookings
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

    // Phase 3A: Refund accounting
    let totalRefunded = 0;
    let pendingRefundsCount = 0;
    let failedRefundsCount = 0;
    try {
      const { data: refundsData } = await supabase
        .from('refunds')
        .select('id, amount, status');
      if (refundsData) {
        totalRefunded = refundsData
          .filter(r => r.status === 'processed')
          .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        totalRefunded = Math.round(totalRefunded * 100) / 100;
        pendingRefundsCount = refundsData.filter(r => ['pending', 'processing'].includes(r.status)).length;
        failedRefundsCount = refundsData.filter(r => r.status === 'failed').length;
      }
    } catch (refErr) {
      // Table may not exist yet in unmigrated environment
    }

    // Phase 3B: Assistant Earnings & Payouts breakdown
    let assistantEarningsPending = 0;
    let assistantEarningsAvailable = 0;
    let assistantEarningsHeld = 0;
    let assistantEarningsPaidOut = 0;
    try {
      const { data: earningsData } = await supabase
        .from('assistant_earnings')
        .select('id, assistant_amount, status');
      if (earningsData) {
        earningsData.forEach((e) => {
          const amt = Number(e.assistant_amount) || 0;
          if (e.status === 'pending') assistantEarningsPending += amt;
          else if (e.status === 'available') assistantEarningsAvailable += amt;
          else if (e.status === 'held') assistantEarningsHeld += amt;
          else if (e.status === 'paid_out') assistantEarningsPaidOut += amt;
        });
        assistantEarningsPending = Math.round(assistantEarningsPending * 100) / 100;
        assistantEarningsAvailable = Math.round(assistantEarningsAvailable * 100) / 100;
        assistantEarningsHeld = Math.round(assistantEarningsHeld * 100) / 100;
        assistantEarningsPaidOut = Math.round(assistantEarningsPaidOut * 100) / 100;
      }
    } catch (eErr) {}

    let payoutsRequested = 0;
    let payoutsProcessing = 0;
    let payoutsFailed = 0;
    let totalPayoutsPaid = 0;
    try {
      const { data: payoutsData } = await supabase
        .from('assistant_payouts')
        .select('id, amount, status');
      if (payoutsData) {
        payoutsRequested = payoutsData.filter(p => p.status === 'requested').length;
        payoutsProcessing = payoutsData.filter(p => p.status === 'processing').length;
        payoutsFailed = payoutsData.filter(p => p.status === 'failed').length;
        totalPayoutsPaid = payoutsData
          .filter(p => p.status === 'paid')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        totalPayoutsPaid = Math.round(totalPayoutsPaid * 100) / 100;
      }
    } catch (pErr) {}

    // Net Revenue = Gross Revenue - Total Refunded
    const netRevenue = Math.max(0, Math.round((grossRevenue - totalRefunded) * 100) / 100);

    const platformCommissionPercent = PLATFORM_COMMISSION_PERCENT; // 20%
    const platformRevenue = Math.round((netRevenue * platformCommissionPercent) / 100 * 100) / 100;
    const assistantEarningsOwed = Math.round((netRevenue - platformRevenue) * 100) / 100;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBookingsList = allBookings.filter(b => b.created_at && b.created_at.startsWith(todayStr));
    const todayBookings = todayBookingsList.length;
    const todayGrossRevenue = todayBookingsList
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
    const todayPlatformRevenue = Math.round((todayGrossRevenue * platformCommissionPercent) / 100 * 100) / 100;

    const pendingPaymentsCount = allBookings.filter(b => b.payment_status === 'pending').length;
    const failedPaymentsCount = allBookings.filter(b => b.payment_status === 'failed').length;

    // Active SOS
    const activeSOS = allBookings.filter(b => b.sos_triggered).length;

    // Status breakdown
    const statusBreakdown = {
      pending: 0,
      accepted: 0,
      arriving: 0,
      in_service: 0,
      completed: 0,
      cancelled: 0,
    };
    allBookings.forEach(b => {
      const s = b.booking_status || 'pending';
      if (statusBreakdown[s] !== undefined) {
        statusBreakdown[s]++;
      } else {
        statusBreakdown[s] = 1;
      }
    });

    // Station breakdown
    const stationMap = {};
    allBookings.forEach(b => {
      const stn = b.station_code || 'OTHER';
      if (!stationMap[stn]) stationMap[stn] = { station: stn, bookings: 0, revenue: 0 };
      stationMap[stn].bookings++;
      if (b.payment_status === 'paid') {
        stationMap[stn].revenue += Number(b.total_price) || 0;
      }
    });
    const stationStats = Object.values(stationMap);

    // Payment method breakdown
    const paymentMap = {};
    allBookings.forEach(b => {
      const m = b.payment_method || 'other';
      paymentMap[m] = (paymentMap[m] || 0) + 1;
    });

    res.json({
      totalBookings,
      pendingAssistants,
      totalAssistants,
      onlineAssistants,
      totalPassengers,
      revenue: grossRevenue, // backward compatible
      grossRevenue,
      netRevenue,
      totalRefunded,
      pendingRefunds: pendingRefundsCount,
      failedRefunds: failedRefundsCount,
      platformRevenue,
      assistantEarningsOwed,
      assistantEarningsPending,
      assistantEarningsAvailable,
      assistantEarningsHeld,
      assistantEarningsPaidOut,
      payoutsRequested,
      payoutsProcessing,
      payoutsFailed,
      totalPayoutsPaid,
      todayRevenue: todayGrossRevenue, // backward compatible
      todayGrossRevenue,
      todayPlatformRevenue,
      todayBookings,
      activeSOS,
      pendingPaymentsCount,
      failedPaymentsCount,
      commissionPercent: platformCommissionPercent,
      statusBreakdown,
      stationStats,
      paymentMap,
    });
  } catch (err) {
    console.error('ADMIN STATS ERROR:', err);
    res.status(500).json({ message: 'Unable to load platform stats.' });
  }
};

// --------------------------------------------------
// PENDING ASSISTANTS (GET /admin/pending-assistants)
// --------------------------------------------------
exports.getPendingAssistants = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, phone, station_code, kyc_status, kyc_documents, created_at')
      .eq('role', 'assistant')
      .eq('is_approved', false)
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ message: error.message });
    res.json(data || []);
  } catch (err) {
    console.error('ADMIN PENDING ASSISTANTS ERROR:', err);
    res.status(500).json({ message: 'Failed to fetch pending assistants.' });
  }
};

// --------------------------------------------------
// ALL ASSISTANTS (GET /admin/assistants)
// --------------------------------------------------
exports.getAssistants = async (req, res) => {
  try {
    const { data: assistants, error } = await supabase
      .from('users')
      .select('id, name, email, phone, station_code, is_approved, is_online, kyc_status, created_at')
      .eq('role', 'assistant')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    // Fetch booking counts per assistant
    const { data: bookings } = await supabase
      .from('bookings')
      .select('assistant_id, booking_status');

    const bookingCounts = {};
    (bookings || []).forEach(b => {
      if (b.assistant_id) {
        if (!bookingCounts[b.assistant_id]) {
          bookingCounts[b.assistant_id] = { total: 0, completed: 0 };
        }
        bookingCounts[b.assistant_id].total++;
        if (b.booking_status === 'completed') {
          bookingCounts[b.assistant_id].completed++;
        }
      }
    });

    const enriched = (assistants || []).map(a => ({
      ...a,
      total_missions: bookingCounts[a.id]?.total || 0,
      completed_missions: bookingCounts[a.id]?.completed || 0,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('ADMIN ALL ASSISTANTS ERROR:', err);
    res.status(500).json({ message: 'Failed to fetch assistants roster.' });
  }
};

// --------------------------------------------------
// APPROVE ASSISTANT (POST /admin/assistants/:id/approve)
// --------------------------------------------------
exports.approveAssistant = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_approved: true, kyc_status: 'approved' })
      .eq('id', req.params.id)
      .eq('role', 'assistant')
      .select();

    if (error || !data || data.length === 0) {
      return res.status(400).json({ message: 'Assistant not found or update failed.' });
    }

    res.json({ message: 'Assistant approved successfully.', user: data[0] });
  } catch (err) {
    console.error('ADMIN APPROVE ERROR:', err);
    res.status(500).json({ message: 'Failed to approve assistant.' });
  }
};

// --------------------------------------------------
// REJECT ASSISTANT (POST /admin/assistants/:id/reject)
// --------------------------------------------------
exports.rejectAssistant = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const { data, error } = await supabase
      .from('users')
      .update({
        is_approved: false,
        kyc_status: 'rejected',
        kyc_rejection_reason: reason || 'Application rejected by administration.',
      })
      .eq('id', req.params.id)
      .eq('role', 'assistant')
      .select();

    if (error) return res.status(400).json({ message: error.message });
    res.json({ message: 'Assistant application rejected.', user: data?.[0] });
  } catch (err) {
    console.error('ADMIN REJECT ERROR:', err);
    res.status(500).json({ message: 'Failed to reject assistant.' });
  }
};

// --------------------------------------------------
// MASTER BOOKING LEDGER (GET /admin/bookings)
// --------------------------------------------------
exports.getAllBookings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        passenger:passenger_id(id, name, email, phone),
        assistant:assistant_id(id, name, email, phone, station_code, is_online)
      `)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    const formatted = (data || []).map(b => formatBooking(b, { includeOTP: true }));
    res.json(formatted);
  } catch (err) {
    console.error('ADMIN ALL BOOKINGS ERROR:', err);
    res.status(500).json({ message: 'Unable to load bookings.' });
  }
};

// --------------------------------------------------
// SINGLE BOOKING DETAILS (GET /admin/bookings/:id)
// --------------------------------------------------
exports.getBookingById = async (req, res) => {
  try {
    const { booking: data, error } = await resolveBooking(
      supabase,
      req.params.id,
      `
        *,
        passenger:passenger_id(id, name, email, phone),
        assistant:assistant_id(id, name, email, phone, station_code, is_online)
      `
    );

    if (error || !data) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const formatted = formatBooking(data, { includeOTP: true });
    res.json(formatted);
  } catch (err) {
    console.error('ADMIN GET BOOKING ERROR:', err);
    res.status(500).json({ message: 'Unable to load booking details.' });
  }
};

// --------------------------------------------------
// UPDATE BOOKING (PATCH /admin/bookings/:id)
// --------------------------------------------------
exports.updateBooking = async (req, res) => {
  try {
    const {
      booking_status,
      assistant_status,
      payment_status,
      assistant_id,
      sos_triggered,
    } = req.body;

    const updates = {};
    if (booking_status !== undefined) {
      updates.booking_status = booking_status;
      if (booking_status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
      if (booking_status === 'in_service') {
        updates.service_started_at = new Date().toISOString();
        updates.start_otp_verified = true;
      }
    }
    if (assistant_status !== undefined) {
      updates.assistant_status = assistant_status;
    } else if (booking_status !== undefined) {
      updates.assistant_status = booking_status;
    }
    if (payment_status !== undefined) {
      updates.payment_status = payment_status;
    }
    if (assistant_id !== undefined) {
      updates.assistant_id = assistant_id === '' ? null : assistant_id;
    }
    if (sos_triggered !== undefined) {
      updates.sos_triggered = sos_triggered;
    }

    const client = req.supabase || supabase;
    const { booking: targetBooking, error: resolveErr } = await resolveBooking(client, req.params.id);
    if (resolveErr || !targetBooking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Phase 6 Security Rule: Admins strictly prohibited from manually marking online payments as paid
    if (payment_status === 'paid' && targetBooking.payment_method !== 'cash') {
      return res.status(400).json({
        message: 'Security Policy: Admins are strictly prohibited from manually marking online payments as paid. Online payments must be finalized by gateway webhooks or HMAC signature verification.'
      });
    }

    const { data, error } = await client
      .from('bookings')
      .update(updates)
      .eq('id', targetBooking.id)
      .select(`
        *,
        passenger:passenger_id(id, name, email, phone),
        assistant:assistant_id(id, name, email, phone, station_code, is_online)
      `)
      .single();

    if (error || !data) {
      return res.status(400).json({ message: error?.message || 'Update failed.' });
    }

    // Sync payments table status if payment_status was updated
    if (payment_status !== undefined) {
      try {
        await supabase
          .from('payments')
          .update({ status: payment_status, updated_at: new Date().toISOString() })
          .eq('booking_id', targetBooking.id);
      } catch (pErr) {}
    }

    // If completed and payment is paid, ensure assistant earnings are generated
    if (data.booking_status === 'completed' && data.payment_status === 'paid' && data.assistant_id) {
      await recordAssistantEarningOnCompletion(supabase, data);
    }

    const formatted = formatBooking(data, { includeOTP: true });

    // Broadcast status change to booking room
    broadcast(req.params.id, formatted);

    res.json(formatted);
  } catch (err) {
    console.error('ADMIN UPDATE BOOKING ERROR:', err);
    res.status(500).json({ message: 'Failed to update booking.' });
  }
};

// --------------------------------------------------
// ALL USERS DIRECTORY (GET /admin/users)
// --------------------------------------------------
exports.getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let query = supabase
      .from('users')
      .select('id, name, email, phone, role, station_code, is_approved, is_online, created_at')
      .order('created_at', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, error } = await query;
    if (error) return res.status(400).json({ message: error.message });

    // Join with booking aggregates for passengers
    const { data: bookings } = await supabase
      .from('bookings')
      .select('passenger_id, total_price, payment_status');

    const userStats = {};
    (bookings || []).forEach(b => {
      if (b.passenger_id) {
        if (!userStats[b.passenger_id]) {
          userStats[b.passenger_id] = { count: 0, totalSpend: 0 };
        }
        userStats[b.passenger_id].count++;
        if (b.payment_status === 'paid') {
          userStats[b.passenger_id].totalSpend += Number(b.total_price) || 0;
        }
      }
    });

    const enriched = (users || []).map(u => ({
      ...u,
      bookings_count: userStats[u.id]?.count || 0,
      total_spent: userStats[u.id]?.totalSpend || 0,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('ADMIN ALL USERS ERROR:', err);
    res.status(500).json({ message: 'Failed to fetch users directory.' });
  }
};

// --------------------------------------------------
// UPDATE USER (PATCH /admin/users/:id)
// --------------------------------------------------
exports.updateUser = async (req, res) => {
  try {
    const { station_code, phone, is_approved, is_online, role } = req.body;
    const updates = {};
    if (station_code !== undefined) updates.station_code = station_code;
    if (phone !== undefined) updates.phone = phone;
    if (is_approved !== undefined) updates.is_approved = is_approved;
    if (is_online !== undefined) updates.is_online = is_online;
    if (role !== undefined) updates.role = role;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, email, phone, role, station_code, is_approved, is_online, created_at')
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.json(data);
  } catch (err) {
    console.error('ADMIN UPDATE USER ERROR:', err);
    res.status(500).json({ message: 'Failed to update user.' });
  }
};

// --------------------------------------------------
// DELETE USER (DELETE /admin/users/:id)
// --------------------------------------------------
exports.deleteUser = async (req, res) => {
  try {
    if (req.user?.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(400).json({ message: error.message });
    res.json({ message: 'User account removed successfully.' });
  } catch (err) {
    console.error('ADMIN DELETE USER ERROR:', err);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
};

// --------------------------------------------------
// SOS ALERTS (GET /admin/sos-alerts)
// --------------------------------------------------
exports.getSOSAlerts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        passenger:passenger_id(id, name, email, phone),
        assistant:assistant_id(id, name, email, phone, station_code)
      `)
      .eq('sos_triggered', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    const formatted = (data || []).map(b => formatBooking(b, { includeOTP: true }));
    res.json(formatted);
  } catch (err) {
    console.error('ADMIN SOS ALERTS ERROR:', err);
    res.status(500).json({ message: 'Failed to fetch SOS alerts.' });
  }
};

// --------------------------------------------------
// RESOLVE SOS (POST /admin/sos-alerts/:id/resolve)
// --------------------------------------------------
exports.resolveSOS = async (req, res) => {
  try {
    const bookingId = req.params.id;

    // 1. Update booking
    const { data, error } = await supabase
      .from('bookings')
      .update({ sos_triggered: false })
      .eq('id', bookingId)
      .select(`
        *,
        passenger:passenger_id(id, name, email, phone),
        assistant:assistant_id(id, name, email, phone, station_code)
      `)
      .single();

    if (error) return res.status(400).json({ message: error.message });

    // 2. Update sos_alerts table if present
    await supabase
      .from('sos_alerts')
      .update({ status: 'resolved' })
      .eq('booking_id', bookingId);

    const formatted = formatBooking(data, { includeOTP: true });
    broadcast(bookingId, formatted);

    res.json({ message: 'Emergency alert marked as resolved.', booking: formatted });
  } catch (err) {
    console.error('ADMIN RESOLVE SOS ERROR:', err);
    res.status(500).json({ message: 'Failed to resolve emergency alert.' });
  }
};

// --------------------------------------------------
// CANCEL BOOKING BY ADMIN (POST /admin/bookings/:id/cancel)
// --------------------------------------------------
exports.cancelBookingByAdmin = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { reason = 'Cancelled by administrator' } = req.body || {};

    const { booking, error: findError } = await resolveBooking(supabase, bookingId);
    if (findError || !booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const { canAdminCancel, determineRefundEligibility } = require('../utils/cancellationRules');
    const { processBookingRefund } = require('../utils/refundService');
    const { reverseAssistantEarning } = require('../utils/earningsService');

    const ruleCheck = canAdminCancel(booking);
    if (!ruleCheck.allowed) {
      if (ruleCheck.isAlreadyCancelled) {
        return res.json({
          success: true,
          idempotent: true,
          message: 'Booking is already cancelled.',
          booking: formatBooking(booking, { includeOTP: false })
        });
      }
      return res.status(400).json({
        success: false,
        message: ruleCheck.reason || 'This booking cannot be cancelled.'
      });
    }

    // Fetch authoritative payment ledger row
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

    // Refund calculation & gateway dispatch
    const refundEligibility = determineRefundEligibility(booking, paymentRecord, 'admin');
    let refundResult = null;
    if (refundEligibility.requiresRefund && paymentRecord) {
      refundResult = await processBookingRefund(supabase, {
        booking,
        payment: paymentRecord,
        refundAmount: refundEligibility.refundAmount,
        reason,
        actorRole: 'admin',
        actorId: req.user?.id || 'admin'
      });
    }

    const nowIso = new Date().toISOString();
    const newPaymentStatus = refundResult?.success
      ? 'refunded'
      : (booking.payment_method === 'cash' || paymentRecord?.status === 'pending')
        ? 'cancelled'
        : booking.payment_status;

    let { data: updatedBooking, error: updateErr } = await supabase
      .from('bookings')
      .update({
        booking_status: 'cancelled',
        payment_status: newPaymentStatus,
        updated_at: nowIso
      })
      .eq('id', booking.id)
      .select('*, passenger:passenger_id(id, name, email, phone), assistant:assistant_id(id, name, email, phone, station_code)')
      .single();

    if (updateErr && updateErr.message?.includes('bookings_payment_status_check')) {
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
      updateErr = retryResult.error;
    }

    if (updateErr) {
      return res.status(400).json({ message: updateErr.message });
    }

    if (paymentRecord?.id && paymentRecord.status === 'pending') {
      try {
        await supabase
          .from('payments')
          .update({ status: 'cancelled', updated_at: nowIso })
          .eq('id', paymentRecord.id);
      } catch (payCancelErr) {}
    }

    // Reverse any pending assistant earnings
    await reverseAssistantEarning(supabase, booking.id, `Admin cancelled booking: ${reason}`);

    const formatted = formatBooking(updatedBooking, { includeOTP: false });
    broadcast(bookingId, formatted);

    const { getIO } = require('./serviceController');
    const io = getIO();
    if (io) {
      io.emit('booking_cancelled', formatted);
      io.emit('status_update', formatted);
    }

    return res.json({
      success: true,
      message: refundResult?.success
        ? `Booking cancelled by admin. Refund of ₹${refundEligibility.refundAmount} processed.`
        : 'Booking cancelled by admin.',
      booking: formatted,
      refund: refundResult?.refund || null
    });

  } catch (err) {
    console.error('ADMIN CANCEL BOOKING ERROR:', err);
    return res.status(500).json({ message: 'Failed to cancel booking.' });
  }
};