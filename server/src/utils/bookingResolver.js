/**
 * server/src/utils/bookingResolver.js
 *
 * Centralized Booking Identifier Resolver for ONECOOLIE
 *
 * Resolves both internal UUIDs (e.g. 550e8400-e29b-41d4-a716-446655440000)
 * and human-readable identifiers (e.g. RM-M7XY9-ABCD).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tests whether a string is a valid UUID format.
 *
 * @param {string} str
 * @returns {boolean}
 */
function isUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

/**
 * Resolves a booking by either UUID or custom booking_id string.
 *
 * @param {object} supabase - Supabase client instance
 * @param {string} identifier - UUID or custom booking_id (e.g. RM-XXXXX)
 * @param {string} [selectQuery='*'] - Columns/relations to select
 * @returns {Promise<{ booking: object|null, error: object|null }>}
 */
async function resolveBooking(supabase, identifier, selectQuery = '*') {
  if (!identifier) {
    return { booking: null, error: { message: 'Booking identifier is required.' } };
  }

  const cleanId = String(identifier).trim();
  const isIdUUID = isUUID(cleanId);

  let query = supabase.from('bookings').select(selectQuery);

  if (isIdUUID) {
    query = query.eq('id', cleanId);
  } else {
    query = query.eq('booking_id', cleanId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { booking: null, error };
  }

  return { booking: data, error: null };
}

module.exports = {
  isUUID,
  resolveBooking
};
