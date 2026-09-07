/**
 * bookingFormatter.js
 *
 * Normalises raw Supabase booking rows into the consistent shape
 * expected by every frontend consumer:
 *
 *   AssistantJobCard  – needs: id, booking_status, assistant_status,
 *                              train_no, train_name, journey_date,
 *                              passenger.name, total_price, services,
 *                              payment_status, payment_method
 *
 *   ActiveBooking     – needs: id, booking_status, train_number,
 *                              train_name, station_code, journey_date,
 *                              services, start_otp (passenger only),
 *                              assistant.name, payment_status,
 *                              payment_method, total_price, rating
 *
 *   PassengerDashboard – needs: id, train_no, train_name, journey_date,
 *                                booking_status, total_price, station_code,
 *                                assistant.name
 *
 *   AdminDashboard    – needs: id, passenger, assistant, train_no,
 *                              station_code, journey_date, total_price,
 *                              booking_status, payment_status, payment_method
 *
 * SECURITY:
 *   start_otp is ONLY included when caller === 'passenger' or 'admin'.
 *   It is never included for the assistant.
 *
 * The returned object always has BOTH:
 *   • train_no   (frontend uses this everywhere in AssistantJobCard /
 *                  PassengerDashboard / AdminDashboard)
 *   • train_number (the actual DB column name, kept for compatibility)
 */

/**
 * Parse the service string or services field stored in the DB into the
 * {key: value} object that the frontend `activeServices()` utility expects.
 *
 * The DB stores a free-text summary like:
 *   "Seat Escorting, Luggage Assistance (2 items)"
 *
 * We convert it back to something like:
 *   { escort: true, luggage: 2 }
 *
 * If the DB already stores an object (future-proof), we pass it through.
 */
function parseServices(serviceField) {
  // Already an object → return as-is
  if (serviceField && typeof serviceField === 'object' && !Array.isArray(serviceField)) {
    return serviceField;
  }

  // Null / empty → return empty object
  if (!serviceField) return {};

  // Parse string summary back into key-value object
  const result = {};

  if (typeof serviceField === 'string') {
    // "Luggage Assistance (2 items)" → luggage: 2
    const luggageMatch = serviceField.match(/Luggage Assistance \((\d+) items?\)/i);
    if (luggageMatch) result.luggage = parseInt(luggageMatch[1], 10);

    if (/Seat Escorting/i.test(serviceField)) result.escort = true;
    if (/Language Help/i.test(serviceField)) result.language = true;
    if (/Wheelchair/i.test(serviceField)) result.wheelchair = true;
    if (/Snacks/i.test(serviceField)) result.snacks = true;
    if (/Exit Transport/i.test(serviceField)) result.transport = true;
  }

  // If nothing matched but there was a string, treat as "general assistance"
  return result;
}

/**
 * Format a raw booking row.
 *
 * @param {object} booking   - Raw Supabase row (may already include passenger/assistant objects from a JOIN)
 * @param {object} [opts]
 * @param {boolean} [opts.includeOTP=false] - Whether to include start_otp in the response
 *
 * @returns {object} Normalised booking object safe to return to clients
 */
function formatBooking(booking, { includeOTP = false } = {}) {
  if (!booking) return null;

  // Passenger relation (may be a nested object from a Supabase .select join,
  // or may have been manually attached before calling formatBooking)
  const passenger = booking.passenger || null;

  // Assistant relation
  const assistant = booking.assistant || null;

  // Always expose BOTH train_no AND train_number so every frontend works
  const trainNo = booking.train_no || booking.train_number || null;

  // Build the canonical services object
  const services = parseServices(booking.services || booking.service || '');

  // Build the output
  const formatted = {
    // ─── Identity ────────────────────────────────────────────────────────────
    id: booking.id,
    booking_id: booking.booking_id || null,

    // ─── Train & Journey ─────────────────────────────────────────────────────
    train_no: trainNo,           // AssistantJobCard / PassengerDashboard
    train_number: trainNo,           // ActiveBooking / legacy
    train_name: booking.train_name || null,
    station_code: booking.station_code || booking.source || null,
    source: booking.source || null,
    destination: booking.destination || null,
    journey_date: booking.journey_date || null,
    journey_time: booking.journey_time || null,

    // ─── Participants ─────────────────────────────────────────────────────────
    passenger_id: booking.passenger_id,
    passenger: passenger
      ? {
        id: passenger.id || booking.passenger_id,
        name: passenger.name || null,
        email: passenger.email || null,
        phone: passenger.phone || null,
      }
      : null,

    assistant_id: booking.assistant_id || null,
    assistant: assistant
      ? {
        id: assistant.id || booking.assistant_id,
        name: assistant.name || null,
        email: assistant.email || null,
        phone: assistant.phone || null,
        station_code: assistant.station_code || null,
        is_online: !!assistant.is_online,
        rating: assistant.rating || booking.assistant_rating || null,
        completed_jobs: assistant.completed_jobs ?? assistant.total_completed ?? assistant.jobs ?? null,
      }
      : null,

    // ─── Services & Coach Telemetry ──────────────────────────────────────────
    services: (booking.services && typeof booking.services === 'object') ? { ...services, ...booking.services } : services,
    service: booking.service || null,
    service_description: booking.service_description || null,
    coach: booking.services?.coach || null,
    seat_number: booking.services?.seat_number || null,
    berth_type: booking.services?.berth_type || null,
    action_type: booking.services?.action_type || 'load_to_seat',
    pnr: booking.services?.pnr || null,
    platform: booking.platform || booking.services?.platform || null,
    previous_platform: booking.previous_platform || booking.services?.previous_platform || null,
    platform_changed: Boolean(booking.platform_changed || booking.services?.platform_changed),
    platform_changed_at: booking.platform_changed_at || booking.services?.platform_changed_at || null,

    // ─── Pricing ─────────────────────────────────────────────────────────────
    total_price: Number(booking.total_price) || 0,

    // ─── Payment ─────────────────────────────────────────────────────────────
    payment_status: booking.payment_status || 'pending',
    payment_method: booking.payment_method || null,
    payment_id: booking.payment_id || null,

    // ─── Status ───────────────────────────────────────────────────────────────
    booking_status: booking.booking_status || 'pending',
    assistant_status: booking.assistant_status || 'pending',

    // ─── SOS Emergency ────────────────────────────────────────────────────────
    sos_triggered: !!booking.sos_triggered,
    sos_triggered_at: booking.sos_triggered_at || null,

    // ─── Rating & Review ──────────────────────────────────────────────────────
    rating: booking.rating || null,
    review: booking.review || null,
    chat_messages: (booking.services && Array.isArray(booking.services.chat_messages)) ? booking.services.chat_messages : [],

    // ─── OTP (conditional) ───────────────────────────────────────────────────
    //   start_otp is ONLY sent when the caller is the passenger or admin.
    //   AssistantJobCard does NOT need it – the assistant asks the passenger.
    ...(includeOTP ? { start_otp: booking.start_otp || null } : {}),
    start_otp_verified: !!booking.start_otp_verified,
    start_otp_expires_at: booking.start_otp_expires_at || null,

    // ─── Timestamps ──────────────────────────────────────────────────────────
    created_at: booking.created_at || null,
    updated_at: booking.updated_at || null,
    accepted_at: booking.accepted_at || booking.services?.accepted_at || (['accepted', 'arriving', 'in_service', 'completed'].includes(booking.booking_status) ? (booking.services?.accepted_at || booking.updated_at || booking.created_at) : null),
    arrived_at: booking.arrived_at || booking.services?.arrived_at || (['arriving', 'in_service', 'completed'].includes(booking.booking_status) ? (booking.services?.arrived_at || booking.updated_at) : null),
    service_started_at: booking.service_started_at || booking.services?.in_service_at || booking.services?.service_started_at || null,
    completed_at: booking.completed_at || booking.services?.completed_at || null,
  };

  return formatted;
}

module.exports = { formatBooking, parseServices };
