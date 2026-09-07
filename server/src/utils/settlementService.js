/**
 * server/src/utils/settlementService.js
 *
 * Settlement Processing Service (Phase 3B)
 *
 * Scans for eligible 'pending' earnings whose hold period (available_at)
 * has matured and transitions them to 'available'.
 * Idempotent, safe, and strictly prevents converting reversed/paid_out earnings.
 */

const { isEarningEligibleForSettlement } = require('../config/settlementRules');

/**
 * Processes pending settlements for an individual assistant or the entire fleet.
 *
 * @param {object} supabase - Supabase client
 * @param {string|null} [assistantId=null] - Optional filter for specific assistant
 * @returns {Promise<{ success: boolean, settledCount: number, error?: object }>}
 */
async function processPendingSettlements(supabase, assistantId = null) {
  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // Query pending earnings where available_at <= now (or available_at is null)
    let query = supabase
      .from('assistant_earnings')
      .select('*')
      .eq('status', 'pending');

    if (assistantId) {
      query = query.eq('assistant_id', assistantId);
    }

    const { data: pendingEarnings, error: fetchErr } = await query;
    if (fetchErr) {
      return { success: false, settledCount: 0, error: fetchErr };
    }

    if (!pendingEarnings || pendingEarnings.length === 0) {
      return { success: true, settledCount: 0 };
    }

    // Filter using centralized settlement rules
    const eligibleEarnings = pendingEarnings.filter((e) =>
      isEarningEligibleForSettlement(e, now)
    );

    if (eligibleEarnings.length === 0) {
      return { success: true, settledCount: 0 };
    }

    const eligibleIds = eligibleEarnings.map((e) => e.id);

    // Atomically transition status: 'pending' -> 'available'
    const { data: updated, error: updateErr } = await supabase
      .from('assistant_earnings')
      .update({
        status: 'available',
        updated_at: nowIso,
      })
      .in('id', eligibleIds)
      .eq('status', 'pending') // atomic guard preventing concurrent conflict
      .select();

    if (updateErr) {
      return { success: false, settledCount: 0, error: updateErr };
    }

    return {
      success: true,
      settledCount: updated?.length || 0,
    };
  } catch (err) {
    return {
      success: false,
      settledCount: 0,
      error: { message: err.message || 'Settlement processing error.' },
    };
  }
}

module.exports = {
  processPendingSettlements,
};
