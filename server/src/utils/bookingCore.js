/**
 * server/src/utils/bookingCore.js
 *
 * Core Booking & Payment Ledger Creation Engine for ONECOOLIE
 *
 * Shared between:
 * - bookingController.createBooking (Cash & direct bookings)
 * - paymentController.createOrder (Online Razorpay order flow)
 *
 * Guarantees 100% identical pricing, validation, and database records across all flows.
 */

const { calculateBookingPrice } = require('../config/pricing');
const { normalizePaymentMethod, isValidPaymentMethod } = require('./paymentClassification');

/**
 * Generates a human-readable booking identifier (e.g. RM-MK19Z-99B1A).
 * @returns {string}
 */
const generateBookingId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `RM-${timestamp}-${random}`;
};

/**
 * Converts services object to readable array.
 * @param {object} services
 * @returns {string[]}
 */
const buildServiceData = (services) => {
  const selectedServices = [];

  if (services && services.luggage && Number(services.luggage) > 0) {
    const quantity = Number(services.luggage);
    selectedServices.push(`Luggage Assistance (${quantity} ${quantity === 1 ? 'item' : 'items'})`);
  } else if (services && services.luggageCounts) {
    const totalLuggage =
      (Number(services.luggageCounts.small) || 0) +
      (Number(services.luggageCounts.medium) || 0) +
      (Number(services.luggageCounts.large) || 0);
    if (totalLuggage > 0) {
      selectedServices.push(`Luggage Assistance (${totalLuggage} ${totalLuggage === 1 ? 'item' : 'items'})`);
    }
  }

  if (services && (services.escort || services.seatEscort)) {
    selectedServices.push('Seat Escorting');
  }

  if (services && (services.language || services.multilingualGuide)) {
    selectedServices.push('Language Help');
  }

  if (services && services.wheelchair) {
    selectedServices.push('Wheelchair & Elderly');
  }

  if (services && (services.snacks || services.berthSnacks)) {
    selectedServices.push('Snacks & Water');
  }

  if (services && (services.transport || services.exitTransport)) {
    selectedServices.push('Exit Transport Help');
  }

  return selectedServices;
};

/**
 * Builds standard service description string for bookings.
 */
const buildServiceDescription = (service, { coach, seat_number, berth_type, action_type, journey_time } = {}) => {
  let description = `Requested services: ${service}`;

  if (coach || seat_number) {
    description += ` | Coach: ${coach || 'TBD'}, Seat: ${seat_number || 'TBD'}`;
    if (berth_type) description += ` (${berth_type})`;
  }

  if (action_type === 'collect_from_seat') {
    description += ` | Mission: De-boarding (Collect from Seat)`;
  } else {
    description += ` | Mission: Boarding (Load into Seat/Berth)`;
  }

  if (journey_time) {
    description += ` | Journey time: ${journey_time}`;
  }

  return description;
};

/**
 * Parses and normalizes incoming booking payload regardless of whether it was sent
 * in flat format or nested ({ journey, seat, services }) format.
 */
const normalizeBookingPayload = (body) => {
  const train_no = body.train_no || body.journey?.train_number || body.journey?.train_no || body.train_number;
  const train_name = body.train_name || body.journey?.train_name;
  const station_code = body.station_code || body.journey?.station_code;
  const journey_date = body.journey_date || body.journey?.journey_date;
  const journey_time = body.journey_time || body.journey?.journey_time || null;

  const coach = body.coach || body.seat?.coach || null;
  const seat_number = body.seat_number || body.seat?.seat_number || null;
  const berth_type = body.berth_type || body.seat?.berth || body.seat?.berth_type || null;
  const action_type = body.action_type || body.services?.action_type || 'load_to_seat';
  const pnr = body.pnr || body.services?.pnr || null;
  const platform = body.platform || body.services?.platform || null;

  const services = body.services;
  const payment_method = body.payment_method;

  return {
    train_no,
    train_name,
    station_code,
    journey_date,
    journey_time,
    coach,
    seat_number,
    berth_type,
    action_type,
    pnr,
    platform,
    services,
    payment_method
  };
};

/**
 * Creates a ONECOOLIE booking and corresponding payment ledger record in Supabase.
 * Enforces authoritative pricing and initial pending states.
 *
 * @param {object} supabase - Supabase client
 * @param {string} userId - Authenticated passenger user ID
 * @param {object} payload - Normalized booking payload
 * @returns {Promise<{ booking: object, paymentRecord: object, pricingResult: object }>}
 */
async function createBookingRecordInDB(supabase, userId, payload) {
  const {
    train_no,
    train_name,
    station_code,
    journey_date,
    journey_time,
    coach,
    seat_number,
    berth_type,
    action_type,
    pnr,
    platform,
    services,
    payment_method
  } = normalizeBookingPayload(payload);

  if (!train_no) throw { status: 400, message: 'Train number is required.' };
  if (!train_name) throw { status: 400, message: 'Train name is required.' };
  if (!station_code) throw { status: 400, message: 'Station is required.' };
  if (!journey_date) throw { status: 400, message: 'Journey date is required.' };
  if (!services) throw { status: 400, message: 'Service is required.' };
  if (!payment_method) throw { status: 400, message: 'Payment method is required.' };

  const normalizedPaymentMethod = normalizePaymentMethod(payment_method);
  if (!isValidPaymentMethod(normalizedPaymentMethod)) {
    throw {
      status: 400,
      message: 'Invalid payment method. Allowed methods: cash, upi, online, card, netbanking.'
    };
  }

  // 1. Authoritative price calculation (ignoring any client total_price / amount)
  const pricingResult = calculateBookingPrice(services);

  // 2. Build service labels and description
  const selectedServices = buildServiceData(services);
  if (selectedServices.length === 0) {
    throw { status: 400, message: 'Please select at least one service.' };
  }
  const service = selectedServices.join(', ');
  const serviceDescription = buildServiceDescription(service, {
    coach,
    seat_number,
    berth_type,
    action_type,
    journey_time
  });

  const bookingId = generateBookingId();

  // 3. Prepare initial booking record
  const bookingData = {
    booking_id: bookingId,
    passenger_id: userId,
    assistant_id: null,
    train_number: String(train_no),
    train_name: train_name,
    journey_date: journey_date,
    journey_time: journey_time,
    station_code: station_code,
    source: station_code,
    destination: station_code,
    service: service,
    services: {
      ...(typeof services === 'object' ? services : {}),
      coach: coach || services?.coach || null,
      seat_number: seat_number || services?.seat_number || null,
      berth_type: berth_type || services?.berth_type || null,
      action_type: action_type || services?.action_type || 'load_to_seat',
      pnr: pnr || services?.pnr || null,
      platform: platform || services?.platform || null,
      pricing_breakdown: pricingResult.breakdown
    },
    service_description: serviceDescription,
    total_price: pricingResult.total,
    payment_method: normalizedPaymentMethod,
    payment_status: 'pending',
    payment_id: null,
    booking_status: 'pending'
  };

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert([bookingData])
    .select('*, passenger:passenger_id(id, name, email, phone)')
    .single();

  if (bookingErr) {
    console.error('CREATE BOOKING DB ERROR:', bookingErr);
    throw { status: 400, message: bookingErr.message };
  }

  // 4. Create dedicated Payment record in payments table
  let paymentRecord = null;
  try {
    const { data: pData, error: pErr } = await supabase
      .from('payments')
      .insert([{
        booking_id: booking.id,
        passenger_id: userId,
        amount: pricingResult.total,
        currency: 'INR',
        payment_method: normalizedPaymentMethod,
        status: 'pending',
        metadata: {
          breakdown: pricingResult.breakdown,
          subtotal: pricingResult.subtotal,
          discount: pricingResult.discount
        }
      }])
      .select()
      .maybeSingle();

    if (pErr) {
      console.warn('Payment insert warning:', pErr.message);
    } else if (pData?.id) {
      paymentRecord = pData;
      // Link payment_id on booking
      await supabase
        .from('bookings')
        .update({ payment_id: pData.id })
        .eq('id', booking.id);
      booking.payment_id = pData.id;
    }
  } catch (payInsertErr) {
    console.warn('Payment ledger insert notice:', payInsertErr.message);
  }

  return {
    booking,
    paymentRecord,
    pricingResult,
    normalizedPaymentMethod
  };
}

module.exports = {
  generateBookingId,
  buildServiceData,
  buildServiceDescription,
  normalizeBookingPayload,
  createBookingRecordInDB
};
