/**
 * server/src/config/pricing.js
 *
 * Centralized Server-Side Pricing Engine for ONECOOLIE
 *
 * Enforces authoritative pricing for all station assistance services.
 * Ignores any client-submitted total_price to prevent client manipulation.
 */

// Service rates matching Indian Railway station assistance tariffs
const SERVICE_RATES = {
  luggage: {
    small: 30,   // ₹30 per small luggage item
    medium: 40,  // ₹40 per medium luggage item
    large: 60,   // ₹60 per large luggage item
    default: 30  // ₹30 fallback per item if size not specified
  },
  escort: 60,     // ₹60 Seat & Coach Escort (per trip)
  wheelchair: 80, // ₹80 Wheelchair & Priority Assistance (per trip)
  language: 30,   // ₹30 Multilingual Guide (per trip)
  snacks: 50,     // ₹50 Berth Refreshments (per trip)
  transport: 40   // ₹40 Exit Gate & Cab Transfer (per trip)
};

/**
 * Validates and sanitizes a non-negative integer.
 */
function sanitizeQuantity(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'boolean') return val ? 1 : 0;
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num) || num <= 0) return 0;
  return Math.floor(num);
}

/**
 * Calculates authoritative booking price from services payload.
 *
 * @param {object} services - Services object from client
 * @returns {object} { subtotal, discount, total, currency, breakdown }
 */
function calculateBookingPrice(services = {}) {
  const breakdown = [];
  let subtotal = 0;

  if (!services || typeof services !== 'object') {
    throw new Error('Invalid services specification.');
  }

  // 1. Luggage Assistance
  const luggageCounts = services.luggageCounts || {};
  const smallCount = sanitizeQuantity(luggageCounts.small);
  const mediumCount = sanitizeQuantity(luggageCounts.medium);
  const largeCount = sanitizeQuantity(luggageCounts.large);
  const totalDetailedLuggage = smallCount + mediumCount + largeCount;

  if (totalDetailedLuggage > 0) {
    if (smallCount > 0) {
      const cost = smallCount * SERVICE_RATES.luggage.small;
      subtotal += cost;
      breakdown.push({
        service: 'luggage_small',
        label: 'Luggage Assistance (Small)',
        quantity: smallCount,
        unit_price: SERVICE_RATES.luggage.small,
        total: cost
      });
    }
    if (mediumCount > 0) {
      const cost = mediumCount * SERVICE_RATES.luggage.medium;
      subtotal += cost;
      breakdown.push({
        service: 'luggage_medium',
        label: 'Luggage Assistance (Medium)',
        quantity: mediumCount,
        unit_price: SERVICE_RATES.luggage.medium,
        total: cost
      });
    }
    if (largeCount > 0) {
      const cost = largeCount * SERVICE_RATES.luggage.large;
      subtotal += cost;
      breakdown.push({
        service: 'luggage_large',
        label: 'Luggage Assistance (Large)',
        quantity: largeCount,
        unit_price: SERVICE_RATES.luggage.large,
        total: cost
      });
    }
  } else {
    // Fallback: general luggage quantity without size breakdown
    const fallbackQty = sanitizeQuantity(services.luggage);
    if (fallbackQty > 0) {
      const cost = fallbackQty * SERVICE_RATES.luggage.default;
      subtotal += cost;
      breakdown.push({
        service: 'luggage',
        label: 'Luggage Assistance',
        quantity: fallbackQty,
        unit_price: SERVICE_RATES.luggage.default,
        total: cost
      });
    }
  }

  // 2. Auxilliary Services
  const auxServices = [
    { key: 'escort', label: 'Seat & Coach Escort', rate: SERVICE_RATES.escort },
    { key: 'wheelchair', label: 'Wheelchair & Priority Transit', rate: SERVICE_RATES.wheelchair },
    { key: 'language', label: 'Multilingual Guide', rate: SERVICE_RATES.language },
    { key: 'snacks', label: 'Berth Refreshments', rate: SERVICE_RATES.snacks },
    { key: 'transport', label: 'Exit Gate & Cab Transfer', rate: SERVICE_RATES.transport }
  ];

  for (const aux of auxServices) {
    const qty = sanitizeQuantity(services[aux.key]);
    if (qty > 0) {
      const cost = qty * aux.rate;
      subtotal += cost;
      breakdown.push({
        service: aux.key,
        label: aux.label,
        quantity: qty,
        unit_price: aux.rate,
        total: cost
      });
    }
  }

  if (breakdown.length === 0 || subtotal <= 0) {
    throw new Error('Please select at least one valid assistance service.');
  }

  const discount = 0;
  const total = Math.max(0, subtotal - discount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount,
    total: Math.round(total * 100) / 100,
    currency: 'INR',
    breakdown
  };
}

module.exports = {
  SERVICE_RATES,
  calculateBookingPrice,
  sanitizeQuantity
};
