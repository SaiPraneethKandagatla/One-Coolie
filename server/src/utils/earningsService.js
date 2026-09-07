/**
 * server/src/utils/earningsService.js
 *
 * Assistant Earnings Creation & Ledger Service (Phase 1)
 *
 * Atomically computes and records assistant earnings and platform commission
 * upon successful service completion of a paid booking.
 */

const { calculateSplit, PLATFORM_COMMISSION_PERCENT } = require('../config/commission');
const { getSettlementStatus, calculateAvailableAt } = require('../config/settlementRules');

/**
 * Creates or retrieves assistant earning record upon booking completion.
 * Idempotent: prevented from duplicates by database UNIQUE constraint and code checks.
 *
 * @param {object} supabase - Supabase client
 * @param {object} booking - Resolved booking object
 * @returns {Promise<{ earning: object|null, error: object|null }>}
 */
async function recordAssistantEarningOnCompletion(supabase, booking) {
  if (!booking || !booking.id) {
    return { earning: null, error: { message: 'Valid booking required.' } };
  }

  if (!booking.assistant_id) {
    return { earning: null, error: { message: 'Cannot record earning: No assistant assigned.' } };
  }

  if (booking.payment_status !== 'paid') {
    return { earning: null, error: { message: 'Cannot record earning: Booking payment is not paid.' } };
  }

  // 1. Check if an earning record already exists for this booking
  try {
    const { data: existing } = await supabase
      .from('assistant_earnings')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();

    if (existing) {
      return { earning: existing, error: null };
    }
  } catch (err) {
    // Table may not exist if migration not run, continue gracefully
  }

  // 2. Fetch associated payment record
  let paymentRecord = null;
  try {
    const { data: pData } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();
    paymentRecord = pData;
  } catch (err) {}

  const grossAmount = Number(paymentRecord?.amount || booking.total_price || 0);
  const split = calculateSplit(grossAmount, PLATFORM_COMMISSION_PERCENT);

  // Settlement rules determine initial availability and hold duration
  const completedAt = booking.completed_at || new Date().toISOString();
  const availableAt = calculateAvailableAt(completedAt);
  const initialStatus = getSettlementStatus(completedAt);

  const earningData = {
    assistant_id: booking.assistant_id,
    booking_id: booking.id,
    payment_id: paymentRecord?.id || null,
    gross_amount: split.grossAmount,
    platform_commission_percent: split.platformCommissionPercent,
    platform_commission_amount: split.platformCommissionAmount,
    assistant_amount: split.assistantAmount,
    status: initialStatus,
    available_at: availableAt
  };

  try {
    const { data, error } = await supabase
      .from('assistant_earnings')
      .insert([earningData])
      .select()
      .single();

    if (error) {
      // Check for race condition / duplicate key violation
      if (error.code === '23505') {
        const { data: raceExisting } = await supabase
          .from('assistant_earnings')
          .select('*')
          .eq('booking_id', booking.id)
          .maybeSingle();
        return { earning: raceExisting, error: null };
      }
      return { earning: null, error };
    }

    return { earning: data, error: null };
  } catch (insertErr) {
    console.warn('assistant_earnings table notice (migration may be pending):', insertErr.message);
    return { earning: null, error: null };
  }
}

/**
 * Safely marks any pending, available or held assistant earnings as 'reversed' upon booking cancellation.
 * Ensures completed / paid_out earnings are protected from silent reversal.
 * Also checks if the reversed earning was reserved in an active payout request and flags the conflict.
 *
 * @param {object} supabase
 * @param {string} bookingId
 * @param {string} [reason='Booking cancelled']
 * @returns {Promise<{ success: boolean, reversedCount: number, affectedPayouts?: Array<string> }>}
 */
async function reverseAssistantEarning(supabase, bookingId, reason = 'Booking cancelled') {
  if (!bookingId) return { success: false, reversedCount: 0 };

  try {
    // 1. Fetch any matching unfinalized earnings
    const { data: targetEarnings, error: fetchErr } = await supabase
      .from('assistant_earnings')
      .select('id, status, assistant_id, assistant_amount')
      .eq('booking_id', bookingId)
      .in('status', ['pending', 'available', 'held']);

    if (fetchErr || !targetEarnings || targetEarnings.length === 0) {
      return { success: true, reversedCount: 0 };
    }

    const targetIds = targetEarnings.map(e => e.id);

    // 2. Perform the update to 'reversed'
    const { data: updated, error: updateErr } = await supabase
      .from('assistant_earnings')
      .update({
        status: 'reversed',
        updated_at: new Date().toISOString()
      })
      .in('id', targetIds)
      .select();

    if (updateErr) {
      return { success: false, reversedCount: 0 };
    }

    // 3. Phase 3B Conflict Safety: Check if any reversed earning was linked in assistant_payout_items
    const affectedPayouts = [];
    try {
      const { data: linkedItems } = await supabase
        .from('assistant_payout_items')
        .select('payout_id, earning_id')
        .in('earning_id', targetIds);

      if (linkedItems && linkedItems.length > 0) {
        for (const item of linkedItems) {
          affectedPayouts.push(item.payout_id);
          // Flag the payout metadata with the reversal conflict
          try {
            const { data: pRecord } = await supabase
              .from('assistant_payouts')
              .select('id, metadata, status')
              .eq('id', item.payout_id)
              .maybeSingle();

            if (pRecord && ['requested', 'approved', 'processing'].includes(pRecord.status)) {
              const currentMeta = pRecord.metadata || {};
              currentMeta.reversal_conflict = true;
              currentMeta.reversal_reason = reason;
              currentMeta.reversed_earning_id = item.earning_id;

              await supabase
                .from('assistant_payouts')
                .update({
                  metadata: currentMeta,
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.payout_id);
            }
          } catch (pUpdateErr) {
            // Non-critical, continue
          }
        }
      }
    } catch (linkErr) {
      // Table may not exist yet in unmigrated environment
    }

    return {
      success: true,
      reversedCount: updated?.length || 0,
      affectedPayouts
    };
  } catch (err) {
    return { success: false, reversedCount: 0 };
  }
}

module.exports = {
  recordAssistantEarningOnCompletion,
  reverseAssistantEarning
};
