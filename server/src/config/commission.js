/**
 * server/src/config/commission.js
 *
 * Configurable Platform Commission & Assistant Earning Engine
 *
 * Default: 20% Platform Commission, 80% Assistant Share
 */

const PLATFORM_COMMISSION_PERCENT = 20.0;
const ASSISTANT_SHARE_PERCENT = 80.0;

/**
 * Calculates platform commission and assistant earning split.
 * Uses 2-decimal rounded arithmetic to avoid floating-point drift.
 *
 * @param {number} grossAmount - Total amount paid by passenger
 * @param {number} [commissionPercent=20.0] - Platform commission percentage
 * @returns {object} { grossAmount, platformCommissionPercent, platformCommissionAmount, assistantAmount }
 */
function calculateSplit(grossAmount, commissionPercent = PLATFORM_COMMISSION_PERCENT) {
  const gross = Math.max(0, Number(grossAmount) || 0);
  const percent = Math.min(100, Math.max(0, Number(commissionPercent) || 0));

  const platformAmount = Math.round((gross * percent) / 100 * 100) / 100;
  const assistantAmount = Math.round((gross - platformAmount) * 100) / 100;

  return {
    grossAmount: gross,
    platformCommissionPercent: percent,
    platformCommissionAmount: platformAmount,
    assistantAmount: assistantAmount
  };
}

module.exports = {
  PLATFORM_COMMISSION_PERCENT,
  ASSISTANT_SHARE_PERCENT,
  calculateSplit,
  calculatePlatformCommission: calculateSplit
};
