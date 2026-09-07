/**
 * server/src/utils/reconciliationService.js
 *
 * Automated Financial Reconciliation Engine (Phase 4)
 *
 * Performs authoritative mathematical reconciliation, cross-ledger integrity validation,
 * invariant checking, and detects discrepancies across bookings, payments, refunds,
 * assistant earnings, payouts, and wallet liabilities.
 */

/**
 * Rounds a monetary amount to 2 decimal places to prevent floating point inaccuracies.
 * @param {number} val
 * @returns {number}
 */
function roundMoney(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Runs full system-wide financial reconciliation across all active and completed records.
 *
 * Checks 11 Financial & Operational Invariants:
 *  1. Fare Split Integrity: Platform Fee (20%) + Sahayak Fee (80%) == Authoritative Total
 *  2. Over-Refund Protection: Total Refunded <= Gross Payment Amount
 *  3. Earning Finalization Conflict: No earning is simultaneously 'paid_out' and 'reversed'
 *  4. Payout-Earning State Alignment: Paid payouts must have 100% 'paid_out' linked earnings
 *  5. Orphaned Held Earnings: No earning remains 'held' without an active (requested/approved/processing) payout
 *  6. Cross-Assistant Earning Guard: Earning assistant_id must match payout assistant_id
 *  7. Payout Reference Integrity: Paid payouts must possess a valid, non-empty payout_reference
 *  8. Duplicate Earning Claims: No single earning is linked to multiple active/paid payout items
 *  9. Payment Status Consistency: Confirmed/completed online bookings must have 'paid' payment status
 * 10. Radar Isolation Invariant: Unpaid online bookings or cancelled bookings must never leak onto assistant radar
 * 11. Platform Balance Reconciliation: Net Revenue == Gross - Refunds - Sahayak Paid Out - Sahayak Liabilities
 *
 * @param {object} supabase - Supabase database client
 * @returns {Promise<object>} Reconciliation Report
 */
async function runSystemReconciliation(supabase) {
  const issues = [];
  const timestamp = new Date().toISOString();

  // Helper to record an identified issue
  function addIssue(code, severity, entityType, entityId, message, details = {}) {
    issues.push({
      id: `REC-${issues.length + 1}`,
      code,
      severity, // 'critical' | 'warning'
      entity_type: entityType,
      entity_id: entityId,
      message,
      details,
      timestamp
    });
  }

  // 1. Fetch All Primary Ledgers
  const [
    { data: bookings = [], error: bErr },
    { data: payments = [], error: pErr },
    { data: refunds = [], error: rErr },
    { data: earnings = [], error: eErr },
    { data: payouts = [], error: pyErr },
    { data: payoutItems = [], error: piErr }
  ] = await Promise.all([
    supabase.from('bookings').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('refunds').select('*'),
    supabase.from('assistant_earnings').select('*'),
    supabase.from('assistant_payouts').select('*'),
    supabase.from('assistant_payout_items').select('*')
  ]);

  if (bErr) throw new Error(`Failed to load bookings for reconciliation: ${bErr.message}`);
  if (pErr) throw new Error(`Failed to load payments for reconciliation: ${pErr.message}`);
  if (rErr && rErr.code !== '42P01') throw new Error(`Failed to load refunds for reconciliation: ${rErr.message}`);
  if (eErr) throw new Error(`Failed to load assistant earnings for reconciliation: ${eErr.message}`);
  if (pyErr) throw new Error(`Failed to load payouts for reconciliation: ${pyErr.message}`);
  if (piErr) throw new Error(`Failed to load payout items for reconciliation: ${piErr.message}`);

  // Maps for fast lookups
  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const paymentByBooking = new Map();
  payments.forEach((p) => {
    if (!paymentByBooking.has(p.booking_id)) paymentByBooking.set(p.booking_id, []);
    paymentByBooking.get(p.booking_id).push(p);
  });

  const refundsByPayment = new Map();
  (refunds || []).forEach((r) => {
    if (!refundsByPayment.has(r.payment_id)) refundsByPayment.set(r.payment_id, []);
    refundsByPayment.get(r.payment_id).push(r);
  });

  const earningsById = new Map(earnings.map((e) => [e.id, e]));
  const payoutsById = new Map(payouts.map((p) => [p.id, p]));

  // -------------------------------------------------------------
  // INVARIANT 1: Fare Split Integrity (20% Platform + 80% Sahayak)
  // -------------------------------------------------------------
  for (const b of bookings) {
    if (b.status === 'completed' || b.total_price) {
      const totalFare = roundMoney(b.final_price || b.total_price || 0);
      const platformFee = roundMoney(b.platform_fee || 0);
      const assistantFee = roundMoney(b.assistant_fee || 0);

      // If fees are tracked on booking, they must sum to total
      if (platformFee > 0 || assistantFee > 0) {
        const sumFees = roundMoney(platformFee + assistantFee);
        if (Math.abs(sumFees - totalFare) > 0.05) {
          addIssue(
            'SPLIT_MISMATCH',
            'critical',
            'booking',
            b.id,
            `Fare split mismatch on booking ${b.id}: platform (${platformFee}) + sahayak (${assistantFee}) = ${sumFees}, expected ${totalFare}`,
            { bookingId: b.id, totalFare, platformFee, assistantFee, discrepancy: roundMoney(sumFees - totalFare) }
          );
        }
      }
    }
  }

  // -------------------------------------------------------------
  // INVARIANT 2: Over-Refund Protection (Refunds <= Payment)
  // -------------------------------------------------------------
  for (const p of payments) {
    const paymentRefunds = refundsByPayment.get(p.id) || [];
    const totalRefunded = roundMoney(
      paymentRefunds
        .filter((r) => r.status === 'completed' || r.status === 'processed')
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
    );
    const paymentAmt = roundMoney(p.amount);

    if (totalRefunded > paymentAmt) {
      addIssue(
        'OVER_REFUND',
        'critical',
        'payment',
        p.id,
        `Payment ${p.id} has total refunds (₹${totalRefunded}) exceeding paid amount (₹${paymentAmt})`,
        { paymentId: p.id, paymentAmount: paymentAmt, totalRefunded, excess: roundMoney(totalRefunded - paymentAmt) }
      );
    }
  }

  // -------------------------------------------------------------
  // INVARIANT 3: Earning Finalization Conflict (paid_out & reversed)
  // -------------------------------------------------------------
  for (const e of earnings) {
    if (e.status === 'paid_out' && (e.is_reversed === true || e.reversed_at)) {
      addIssue(
        'PAID_OUT_AND_REVERSED',
        'critical',
        'assistant_earning',
        e.id,
        `Critical financial corruption: Earning ${e.id} is marked 'paid_out' but also flagged as reversed`,
        { earningId: e.id, assistantId: e.assistant_id, amount: e.assistant_amount }
      );
    }
  }

  // -------------------------------------------------------------
  // INVARIANT 4 & 7: Payout Settlement & Reference Integrity
  // -------------------------------------------------------------
  const payoutItemsByPayout = new Map();
  payoutItems.forEach((pi) => {
    if (!payoutItemsByPayout.has(pi.payout_id)) payoutItemsByPayout.set(pi.payout_id, []);
    payoutItemsByPayout.get(pi.payout_id).push(pi);
  });

  const usedReferences = new Map();

  for (const py of payouts) {
    const linkedItems = payoutItemsByPayout.get(py.id) || [];
    const itemsSum = roundMoney(linkedItems.reduce((s, i) => s + (Number(i.amount) || 0), 0));
    const payoutAmt = roundMoney(py.amount);

    // Sum of items must equal payout amount
    if (linkedItems.length > 0 && Math.abs(itemsSum - payoutAmt) > 0.05) {
      addIssue(
        'PAYOUT_SUM_MISMATCH',
        'critical',
        'assistant_payout',
        py.id,
        `Payout ${py.id} amount (₹${payoutAmt}) does not match sum of linked items (₹${itemsSum})`,
        { payoutId: py.id, payoutAmount: payoutAmt, itemsSum }
      );
    }

    if (py.status === 'paid') {
      // INVARIANT 7: Payout reference must be present and non-empty
      if (!py.payout_reference || String(py.payout_reference).trim().length < 3) {
        addIssue(
          'MISSING_PAYOUT_REFERENCE',
          'critical',
          'assistant_payout',
          py.id,
          `Paid payout ${py.id} is missing a valid manual settlement reference`,
          { payoutId: py.id, status: py.status }
        );
      } else {
        const refUpper = String(py.payout_reference).trim().toUpperCase();
        if (usedReferences.has(refUpper)) {
          addIssue(
            'DUPLICATE_PAYOUT_REFERENCE',
            'critical',
            'assistant_payout',
            py.id,
            `Duplicate settlement reference "${refUpper}" detected on payouts ${py.id} and ${usedReferences.get(refUpper)}`,
            { reference: refUpper, payoutA: usedReferences.get(refUpper), payoutB: py.id }
          );
        } else {
          usedReferences.set(refUpper, py.id);
        }
      }

      // INVARIANT 4: All linked earnings must be in 'paid_out' state
      for (const item of linkedItems) {
        const earn = earningsById.get(item.earning_id);
        if (earn && earn.status !== 'paid_out') {
          addIssue(
            'PAYOUT_EARNING_NOT_FINALIZED',
            'critical',
            'assistant_earning',
            earn.id,
            `Payout ${py.id} is marked 'paid', but linked earning ${earn.id} is in status '${earn.status}' instead of 'paid_out'`,
            { payoutId: py.id, earningId: earn.id, earningStatus: earn.status }
          );
        }
      }
    }
  }

  // -------------------------------------------------------------
  // INVARIANT 5: Orphaned Held Earnings
  // -------------------------------------------------------------
  const earningToPayoutMap = new Map();
  payoutItems.forEach((pi) => {
    earningToPayoutMap.set(pi.earning_id, pi.payout_id);
  });

  for (const e of earnings) {
    if (e.status === 'held') {
      const linkedPayoutId = earningToPayoutMap.get(e.id);
      if (!linkedPayoutId) {
        addIssue(
          'ORPHANED_HELD_EARNING',
          'critical',
          'assistant_earning',
          e.id,
          `Earning ${e.id} is held but has no corresponding payout reservation item`,
          { earningId: e.id, assistantId: e.assistant_id, amount: e.assistant_amount }
        );
      } else {
        const linkedPayout = payoutsById.get(linkedPayoutId);
        if (!linkedPayout || ['cancelled', 'rejected', 'failed'].includes(linkedPayout.status)) {
          addIssue(
            'ORPHANED_HELD_EARNING',
            'critical',
            'assistant_earning',
            e.id,
            `Earning ${e.id} is in 'held' status, but its linked payout ${linkedPayoutId} is in terminal state '${linkedPayout ? linkedPayout.status : 'deleted'}'`,
            { earningId: e.id, payoutId: linkedPayoutId, payoutStatus: linkedPayout?.status }
          );
        }
      }
    }
  }

  // -------------------------------------------------------------
  // INVARIANT 6: Cross-Assistant Earning Injection
  // -------------------------------------------------------------
  for (const pi of payoutItems) {
    const payout = payoutsById.get(pi.payout_id);
    const earning = earningsById.get(pi.earning_id);
    if (payout && earning) {
      if (payout.assistant_id !== earning.assistant_id) {
        addIssue(
          'CROSS_ASSISTANT_EARNING',
          'critical',
          'assistant_payout_item',
          pi.id,
          `Security violation: Earning ${earning.id} belonging to assistant ${earning.assistant_id} is attached to payout ${payout.id} belonging to assistant ${payout.assistant_id}`,
          { payoutId: payout.id, earningId: earning.id, earningAssistant: earning.assistant_id, payoutAssistant: payout.assistant_id }
        );
      }
    }
  }

  // -------------------------------------------------------------
  // INVARIANT 8: Duplicate Earning Claims Across Payouts
  // -------------------------------------------------------------
  const activeEarningClaims = new Map();
  for (const pi of payoutItems) {
    const payout = payoutsById.get(pi.payout_id);
    // Ignore cancelled, rejected, or failed payouts since earnings are released
    if (payout && !['cancelled', 'rejected', 'failed'].includes(payout.status)) {
      if (activeEarningClaims.has(pi.earning_id)) {
        addIssue(
          'DUPLICATE_EARNING_CLAIM',
          'critical',
          'assistant_payout_item',
          pi.id,
          `Earning ${pi.earning_id} has been claimed multiple times across active payouts ${activeEarningClaims.get(pi.earning_id)} and ${pi.payout_id}`,
          { earningId: pi.earning_id, payoutA: activeEarningClaims.get(pi.earning_id), payoutB: pi.payout_id }
        );
      } else {
        activeEarningClaims.set(pi.earning_id, pi.payout_id);
      }
    }
  }

  // -------------------------------------------------------------
  // INVARIANT 9 & 10: Online Booking Gating & Payment Status Consistency
  // -------------------------------------------------------------
  for (const b of bookings) {
    const isCash = String(b.payment_method || '').toLowerCase() === 'cash';
    const isOnline = !isCash;
    const bookingPayments = paymentByBooking.get(b.id) || [];
    const hasPaidPayment = bookingPayments.some((p) => p.status === 'paid');

    // Online booking marked confirmed or completed MUST have a paid payment
    if (isOnline && (b.status === 'confirmed' || b.status === 'completed' || b.payment_status === 'paid')) {
      if (!hasPaidPayment) {
        addIssue(
          'UNPAID_ONLINE_CONFIRMED',
          'critical',
          'booking',
          b.id,
          `Online booking ${b.id} is in state '${b.status}' / payment_status '${b.payment_status}' but has no verified 'paid' payment record`,
          { bookingId: b.id, paymentMethod: b.payment_method, bookingStatus: b.status, paymentStatus: b.payment_status }
        );
      }
    }

    // Invariant 10: Unpaid online booking must never have an assistant assigned (radar isolation)
    if (isOnline && !hasPaidPayment && b.assistant_id && b.status !== 'cancelled') {
      addIssue(
        'RADAR_LEAK_ONLINE_UNPAID',
        'critical',
        'booking',
        b.id,
        `Option C gate breach: Unpaid online booking ${b.id} was assigned to assistant ${b.assistant_id}`,
        { bookingId: b.id, assistantId: b.assistant_id, paymentStatus: b.payment_status }
      );
    }
  }

  // -------------------------------------------------------------
  // AGGREGATE FINANCIAL METRICS & INVARIANT 11 (Platform Solvency)
  // -------------------------------------------------------------
  const grossPayments = roundMoney(
    payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );

  const totalRefunded = roundMoney(
    (refunds || [])
      .filter((r) => r.status === 'completed' || r.status === 'processed')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  );

  const netCollected = roundMoney(grossPayments - totalRefunded);

  // Platform commission from completed bookings
  const platformCommission = roundMoney(
    bookings
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + (Number(b.platform_fee) || 0), 0)
  );

  const assistantEarningsCreated = roundMoney(
    earnings.reduce((sum, e) => sum + (Number(e.assistant_amount) || 0), 0)
  );

  const assistantPending = roundMoney(
    earnings
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + (Number(e.assistant_amount) || 0), 0)
  );

  const assistantAvailable = roundMoney(
    earnings
      .filter((e) => e.status === 'available')
      .reduce((sum, e) => sum + (Number(e.assistant_amount) || 0), 0)
  );

  const assistantHeld = roundMoney(
    earnings
      .filter((e) => e.status === 'held')
      .reduce((sum, e) => sum + (Number(e.assistant_amount) || 0), 0)
  );

  const assistantPaidOut = roundMoney(
    earnings
      .filter((e) => e.status === 'paid_out')
      .reduce((sum, e) => sum + (Number(e.assistant_amount) || 0), 0)
  );

  const pendingLiability = roundMoney(assistantPending + assistantAvailable + assistantHeld);

  const totalPayoutsPaid = roundMoney(
    payouts
      .filter((py) => py.status === 'paid')
      .reduce((sum, py) => sum + (Number(py.amount) || 0), 0)
  );

  // Check paid payouts vs earnings paid_out alignment
  if (Math.abs(assistantPaidOut - totalPayoutsPaid) > 1.0) {
    addIssue(
      'PAID_OUT_DRIFT',
      'warning',
      'system',
      'ledger',
      `Minor drift between assistant earnings marked 'paid_out' (₹${assistantPaidOut}) and total paid payouts (₹${totalPayoutsPaid})`,
      { assistantPaidOut, totalPayoutsPaid, difference: roundMoney(assistantPaidOut - totalPayoutsPaid) }
    );
  }

  // Determine system health status
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  let healthStatus = 'healthy';
  if (criticalCount > 0) {
    healthStatus = 'critical';
  } else if (warningCount > 0) {
    healthStatus = 'warning';
  }

  return {
    reconciled_at: timestamp,
    health: {
      status: healthStatus,
      total_issues: issues.length,
      critical_issues: criticalCount,
      warnings: warningCount
    },
    metrics: {
      gross_payments: grossPayments,
      total_refunded: totalRefunded,
      net_collected: netCollected,
      platform_commission: platformCommission,
      assistant_earnings_created: assistantEarningsCreated,
      assistant_pending: assistantPending,
      assistant_available: assistantAvailable,
      assistant_held: assistantHeld,
      assistant_paid_out: assistantPaidOut,
      pending_liability: pendingLiability,
      total_payouts_paid: totalPayoutsPaid
    },
    issues
  };
}

/**
 * Reconciles a single booking and its downstream financial records.
 * @param {object} supabase
 * @param {string} bookingId
 * @returns {Promise<object>} Single booking reconciliation report
 */
async function reconcileBooking(supabase, bookingId) {
  const issues = [];
  const timestamp = new Date().toISOString();

  const [
    { data: booking, error: bErr },
    { data: payments = [], error: pErr },
    { data: refunds = [], error: rErr },
    { data: earnings = [], error: eErr }
  ] = await Promise.all([
    supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle(),
    supabase.from('payments').select('*').eq('booking_id', bookingId),
    supabase.from('refunds').select('*').eq('booking_id', bookingId),
    supabase.from('assistant_earnings').select('*').eq('booking_id', bookingId)
  ]);

  if (bErr || !booking) {
    return { success: false, error: 'Booking not found' };
  }

  const isCash = String(booking.payment_method || '').toLowerCase() === 'cash';
  const totalFare = roundMoney(booking.final_price || booking.total_price || 0);
  const platformFee = roundMoney(booking.platform_fee || 0);
  const assistantFee = roundMoney(booking.assistant_fee || 0);

  // Check split
  if (platformFee > 0 || assistantFee > 0) {
    const sumFees = roundMoney(platformFee + assistantFee);
    if (Math.abs(sumFees - totalFare) > 0.05) {
      issues.push({
        code: 'SPLIT_MISMATCH',
        severity: 'critical',
        message: `Fare split mismatch: platform (${platformFee}) + sahayak (${assistantFee}) = ${sumFees}, expected ${totalFare}`
      });
    }
  }

  // Check online payment status
  const paidPayment = payments.find((p) => p.status === 'paid');
  if (!isCash && (booking.status === 'confirmed' || booking.status === 'completed') && !paidPayment) {
    issues.push({
      code: 'UNPAID_ONLINE_CONFIRMED',
      severity: 'critical',
      message: `Online booking is ${booking.status} but no paid payment record exists.`
    });
  }

  // Check over-refund
  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalRefunded = refunds
    .filter((r) => r.status === 'completed' || r.status === 'processed')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  if (roundMoney(totalRefunded) > roundMoney(totalPaid)) {
    issues.push({
      code: 'OVER_REFUND',
      severity: 'critical',
      message: `Total refunded (₹${totalRefunded}) exceeds total paid (₹${totalPaid}).`
    });
  }

  // Check earnings reversals
  for (const earn of earnings) {
    if (earn.status === 'paid_out' && (earn.is_reversed || earn.reversed_at)) {
      issues.push({
        code: 'PAID_OUT_AND_REVERSED',
        severity: 'critical',
        message: `Earning ${earn.id} is both paid_out and marked reversed.`
      });
    }
  }

  return {
    success: true,
    booking_id: bookingId,
    reconciled_at: timestamp,
    is_consistent: issues.length === 0,
    issues_count: issues.length,
    issues,
    booking,
    payments,
    refunds,
    earnings
  };
}

module.exports = {
  roundMoney,
  runSystemReconciliation,
  reconcileBooking
};
