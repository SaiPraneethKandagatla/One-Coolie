/**
 * server/src/utils/walletService.js
 *
 * Authoritative Assistant Wallet Service (Phase 3B)
 *
 * Computes wallet balances and earning history directly from the
 * assistant_earnings and assistant_payouts ledgers.
 * Strictly ignores any client-supplied balance values.
 */

/**
 * Calculates authoritative wallet balances for an assistant.
 *
 * @param {object} supabase - Supabase client
 * @param {string} assistantId - UUID of the assistant
 * @returns {Promise<{ success: boolean, wallet?: object, error?: object }>}
 */
async function getAssistantWallet(supabase, assistantId) {
  if (!assistantId) {
    return { success: false, error: { message: 'Assistant ID is required.' } };
  }

  try {
    // 1. Query all earnings for this assistant
    const { data: earnings, error: earnErr } = await supabase
      .from('assistant_earnings')
      .select('id, assistant_amount, status, created_at, available_at')
      .eq('assistant_id', assistantId);

    if (earnErr) {
      return { success: false, error: earnErr };
    }

    const allEarnings = earnings || [];

    let pendingBalance = 0;
    let availableBalance = 0;
    let heldBalance = 0;
    let paidOutTotal = 0;

    for (const e of allEarnings) {
      const amt = Number(e.assistant_amount) || 0;
      switch (e.status) {
        case 'pending':
          pendingBalance += amt;
          break;
        case 'available':
          availableBalance += amt;
          break;
        case 'held':
          heldBalance += amt;
          break;
        case 'paid_out':
          paidOutTotal += amt;
          break;
        case 'reversed':
          // Reversed earnings are permanently excluded from all positive balances
          break;
        default:
          break;
      }
    }

    // Round all metrics to 2 decimal places
    pendingBalance = Math.round(pendingBalance * 100) / 100;
    availableBalance = Math.round(availableBalance * 100) / 100;
    heldBalance = Math.round(heldBalance * 100) / 100;
    paidOutTotal = Math.round(paidOutTotal * 100) / 100;

    const totalEarnings = Math.round((pendingBalance + availableBalance + heldBalance + paidOutTotal) * 100) / 100;

    return {
      success: true,
      wallet: {
        assistant_id: assistantId,
        currency: 'INR',
        pending_balance: pendingBalance,
        available_balance: availableBalance,
        held_balance: heldBalance,
        paid_out_total: paidOutTotal,
        total_earnings: totalEarnings,
      }
    };
  } catch (err) {
    return { success: false, error: { message: err.message || 'Error fetching assistant wallet.' } };
  }
}

/**
 * Returns available balance for withdrawal.
 * @param {object} supabase
 * @param {string} assistantId
 * @returns {Promise<number>}
 */
async function getAvailableBalance(supabase, assistantId) {
  const result = await getAssistantWallet(supabase, assistantId);
  if (!result.success || !result.wallet) return 0;
  return result.wallet.available_balance;
}

/**
 * Returns pending balance.
 * @param {object} supabase
 * @param {string} assistantId
 * @returns {Promise<number>}
 */
async function getPendingBalance(supabase, assistantId) {
  const result = await getAssistantWallet(supabase, assistantId);
  if (!result.success || !result.wallet) return 0;
  return result.wallet.pending_balance;
}

/**
 * Returns held balance.
 * @param {object} supabase
 * @param {string} assistantId
 * @returns {Promise<number>}
 */
async function getHeldBalance(supabase, assistantId) {
  const result = await getAssistantWallet(supabase, assistantId);
  if (!result.success || !result.wallet) return 0;
  return result.wallet.held_balance;
}

/**
 * Returns total paid out amount.
 * @param {object} supabase
 * @param {string} assistantId
 * @returns {Promise<number>}
 */
async function getPaidOutTotal(supabase, assistantId) {
  const result = await getAssistantWallet(supabase, assistantId);
  if (!result.success || !result.wallet) return 0;
  return result.wallet.paid_out_total;
}

/**
 * Retrieves the comprehensive earning ledger history for an assistant.
 * @param {object} supabase
 * @param {string} assistantId
 * @returns {Promise<{ success: boolean, earnings?: Array<object>, error?: object }>}
 */
async function getEarningHistory(supabase, assistantId) {
  if (!assistantId) {
    return { success: false, error: { message: 'Assistant ID is required.' } };
  }

  try {
    const { data, error } = await supabase
      .from('assistant_earnings')
      .select('*, booking:booking_id(id, booking_id, station_code, created_at, completed_at, payment_method)')
      .eq('assistant_id', assistantId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error };

    return { success: true, earnings: data || [] };
  } catch (err) {
    return { success: false, error: { message: err.message } };
  }
}

module.exports = {
  getAssistantWallet,
  getAvailableBalance,
  getPendingBalance,
  getHeldBalance,
  getPaidOutTotal,
  getEarningHistory,
};
