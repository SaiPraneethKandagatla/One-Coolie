/**
 * server/src/config/settlementRules.js
 *
 * Centralized Settlement Rules Utility (Phase 3B)
 *
 * Governs the transition of assistant earnings from 'pending' to 'available'.
 * Supports a configurable settlement hold duration via ASSISTANT_SETTLEMENT_HOURS.
 * Default is 0 for instant availability in dev/test environments.
 */

const DEFAULT_SETTLEMENT_HOURS = 0;

/**
 * Returns the configured settlement hold hours from environment.
 * @returns {number}
 */
function getSettlementHours() {
  const envVal = process.env.ASSISTANT_SETTLEMENT_HOURS;
  if (envVal !== undefined && envVal !== null && envVal !== '') {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_SETTLEMENT_HOURS;
}

/**
 * Calculates the ISO timestamp when an earning becomes eligible for withdrawal.
 * @param {Date|string} [completedAt=new Date()]
 * @param {number} [settlementHours]
 * @returns {string} ISO Date string
 */
function calculateAvailableAt(completedAt = new Date(), settlementHours = getSettlementHours()) {
  const baseTime = new Date(completedAt).getTime();
  const validBase = isNaN(baseTime) ? Date.now() : baseTime;
  const availableMs = validBase + (settlementHours * 60 * 60 * 1000);
  return new Date(availableMs).toISOString();
}

/**
 * Determines the initial earning status upon booking completion.
 * If settlement hours is 0, the earning is immediately 'available'.
 * If settlement hours > 0, the earning starts as 'pending'.
 * @param {Date|string} [completedAt=new Date()]
 * @param {number} [settlementHours]
 * @returns {'available'|'pending'}
 */
function getSettlementStatus(completedAt = new Date(), settlementHours = getSettlementHours()) {
  const availableAt = new Date(calculateAvailableAt(completedAt, settlementHours)).getTime();
  const now = Date.now();
  return now >= availableAt ? 'available' : 'pending';
}

/**
 * Evaluates whether a specific earning record is eligible to be settled (moved to 'available').
 * INVARIANT: 'reversed' and 'paid_out' earnings can NEVER be moved to 'available'.
 *
 * @param {object} earning - Database earning record
 * @param {Date|string} [now=new Date()]
 * @returns {boolean}
 */
function isEarningEligibleForSettlement(earning, now = new Date()) {
  if (!earning || !earning.id) return false;

  // Strict invariant protection
  if (earning.status === 'reversed' || earning.status === 'paid_out') {
    return false;
  }

  // Already available or held in active payout
  if (earning.status !== 'pending') {
    return false;
  }

  if (!earning.available_at) {
    return true; // No hold specified, eligible
  }

  const checkTime = new Date(now).getTime();
  const availableTime = new Date(earning.available_at).getTime();

  return checkTime >= availableTime;
}

/**
 * Validates whether an earning can be transitioned to 'available'.
 * @param {object} earning
 * @param {Date|string} [now=new Date()]
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canMoveToAvailable(earning, now = new Date()) {
  if (!earning) {
    return { allowed: false, reason: 'Invalid earning record.' };
  }

  if (earning.status === 'reversed') {
    return { allowed: false, reason: 'Reversed earnings can never become available.' };
  }

  if (earning.status === 'paid_out') {
    return { allowed: false, reason: 'Already paid out earnings cannot become available again.' };
  }

  if (earning.status === 'available') {
    return { allowed: false, reason: 'Earning is already available.' };
  }

  if (earning.status === 'held') {
    return { allowed: false, reason: 'Earning is held in an active payout or dispute.' };
  }

  if (!isEarningEligibleForSettlement(earning, now)) {
    return { allowed: false, reason: 'Settlement maturity period has not yet elapsed.' };
  }

  return { allowed: true };
}

module.exports = {
  getSettlementHours,
  calculateAvailableAt,
  getSettlementStatus,
  isEarningEligibleForSettlement,
  canMoveToAvailable,
};
