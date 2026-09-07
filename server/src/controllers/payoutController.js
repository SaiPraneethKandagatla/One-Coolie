/**
 * server/src/controllers/payoutController.js
 *
 * Payout & Settlement Controller (Phase 3B)
 *
 * Orchestrates Assistant Wallet operations, Payout Requests,
 * Admin Approval Workflow, Failure Recovery, and Phase 3A Conflict Protection.
 */

const supabase = require('../config/db');
const walletService = require('../utils/walletService');
const { processPendingSettlements } = require('../utils/settlementService');
const payoutRules = require('../config/payoutRules');
const auditService = require('../utils/auditService');

let io = null;

function setIO(ioInstance) {
  io = ioInstance;
}

function emitWalletUpdate(assistantId, payload = {}) {
  if (!io || !assistantId) return;
  try {
    io.to(`assistant_${assistantId}`).emit('wallet_updated', {
      assistantId,
      timestamp: new Date().toISOString(),
      ...payload
    });
  } catch (err) {
    console.warn('Socket emit wallet_updated error:', err.message);
  }
}

/**
 * Finds a combination or greedy subset of available earnings to satisfy requested amount.
 * @param {Array<object>} availableEarnings
 * @param {number} targetAmount
 * @returns {Array<object>|null}
 */
function selectEarningsForPayout(availableEarnings, targetAmount) {
  if (!availableEarnings || availableEarnings.length === 0) return null;

  const target = Math.round(Number(targetAmount) * 100) / 100;

  // 1. Single exact match
  const exactSingle = availableEarnings.find(
    (e) => Math.round(Number(e.assistant_amount) * 100) / 100 === target
  );
  if (exactSingle) return [exactSingle];

  // 2. All available earnings exact match
  const totalAvail = availableEarnings.reduce((s, e) => s + (Number(e.assistant_amount) || 0), 0);
  if (Math.round(totalAvail * 100) / 100 === target) {
    return [...availableEarnings];
  }

  // 3. Exact subset search (dynamic programming / recursive subset sum)
  function findExactSubset(items, currentTarget, startIndex) {
    if (Math.abs(currentTarget) < 0.001) return [];
    if (currentTarget < 0 || startIndex >= items.length) return null;

    const currentItem = items[startIndex];
    const amt = Number(currentItem.assistant_amount) || 0;

    // Try including currentItem
    const withCurrent = findExactSubset(items, Math.round((currentTarget - amt) * 100) / 100, startIndex + 1);
    if (withCurrent !== null) {
      return [currentItem, ...withCurrent];
    }

    // Try excluding currentItem
    return findExactSubset(items, currentTarget, startIndex + 1);
  }

  const exactSubset = findExactSubset(availableEarnings, target, 0);
  if (exactSubset) return exactSubset;

  // 4. Greedy accumulation (oldest first) until sum >= target
  let accumulated = 0;
  const selected = [];
  for (const e of availableEarnings) {
    selected.push(e);
    accumulated += Number(e.assistant_amount) || 0;
    if (Math.round(accumulated * 100) / 100 >= target) {
      return selected;
    }
  }

  return null;
}

// --------------------------------------------------
// ASSISTANT ENDPOINTS
// --------------------------------------------------

/**
 * GET /api/assistant-wallet
 * Returns authoritative wallet balances.
 */
exports.getWallet = async (req, res) => {
  try {
    const assistantId = req.user.id;

    // Automatically trigger settlement for any matured earnings
    await processPendingSettlements(supabase, assistantId);

    const result = await walletService.getAssistantWallet(supabase, assistantId);
    if (!result.success) {
      return res.status(500).json({ message: result.error?.message || 'Error loading wallet.' });
    }

    res.json(result);
  } catch (err) {
    console.error('GET WALLET ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve assistant wallet.' });
  }
};

/**
 * GET /api/assistant-wallet/earnings
 * Returns earning ledger history for the assistant.
 */
exports.getEarnings = async (req, res) => {
  try {
    const assistantId = req.user.id;
    const result = await walletService.getEarningHistory(supabase, assistantId);
    if (!result.success) {
      return res.status(500).json({ message: result.error?.message || 'Error loading earnings.' });
    }
    res.json({ success: true, earnings: result.earnings });
  } catch (err) {
    console.error('GET EARNINGS ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve earnings history.' });
  }
};

/**
 * GET /api/assistant-payouts
 * Returns all payouts requested by this assistant.
 */
exports.getMyPayouts = async (req, res) => {
  try {
    const assistantId = req.user.id;

    const { data: payouts, error } = await supabase
      .from('assistant_payouts')
      .select('*, items:assistant_payout_items(*)')
      .eq('assistant_id', assistantId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.json({ success: true, payouts: payouts || [] });
  } catch (err) {
    console.error('GET MY PAYOUTS ERROR:', err);
    res.status(500).json({ message: 'Unable to retrieve payout requests.' });
  }
};

/**
 * GET /api/assistant-payouts/:id
 * Returns single payout detail with ownership validation.
 */
exports.getPayoutById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: payout, error } = await supabase
      .from('assistant_payouts')
      .select('*, items:assistant_payout_items(*, earning:earning_id(*))')
      .eq('id', id)
      .maybeSingle();

    if (error || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    // Authorization: Assistant can only access own payout; Admins can access all
    if (req.user.role !== 'admin' && payout.assistant_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden: You do not own this payout record.' });
    }

    res.json({ success: true, payout });
  } catch (err) {
    console.error('GET PAYOUT BY ID ERROR:', err);
    res.status(500).json({ message: 'Unable to load payout details.' });
  }
};

/**
 * POST /api/assistant-payouts/request
 * Assistant requests a payout withdrawal.
 */
exports.requestPayout = async (req, res) => {
  try {
    const assistantId = req.user.id;
    const { amount, payout_method = 'bank_transfer', metadata = {} } = req.body;

    // 1. Trigger pending settlements first
    await processPendingSettlements(supabase, assistantId);

    // 2. Fetch authoritative available balance
    const availableBalance = await walletService.getAvailableBalance(supabase, assistantId);

    // 3. Centralized rule validation
    const ruleCheck = payoutRules.canAssistantRequestPayout(availableBalance, amount);
    if (!ruleCheck.allowed) {
      return res.status(400).json({ message: ruleCheck.reason });
    }

    const requestedAmount = Math.round(Number(amount) * 100) / 100;

    // 4. Fetch available earnings for this assistant
    const { data: availableEarnings, error: fetchErr } = await supabase
      .from('assistant_earnings')
      .select('*')
      .eq('assistant_id', assistantId)
      .eq('status', 'available')
      .order('created_at', { ascending: true });

    if (fetchErr || !availableEarnings || availableEarnings.length === 0) {
      return res.status(400).json({ message: 'No available earnings found for withdrawal.' });
    }

    // 5. Select earnings to satisfy requested amount
    const selectedEarnings = selectEarningsForPayout(availableEarnings, requestedAmount);
    if (!selectedEarnings || selectedEarnings.length === 0) {
      return res.status(400).json({ message: 'Could not allocate eligible earnings to match requested amount.' });
    }

    const selectedIds = selectedEarnings.map((e) => e.id);

    // 6. Create payout record
    const payoutData = {
      assistant_id: assistantId,
      amount: requestedAmount,
      currency: 'INR',
      status: 'requested',
      payout_method: String(payout_method || 'bank_transfer').toLowerCase(),
      metadata: typeof metadata === 'object' ? metadata : {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdPayout, error: pCreateErr } = await supabase
      .from('assistant_payouts')
      .insert([payoutData])
      .select()
      .single();

    if (pCreateErr) {
      return res.status(500).json({ message: 'Failed to create payout record: ' + pCreateErr.message });
    }

    // 7. Atomically reserve earnings: transition status 'available' -> 'held'
    const { data: heldEarnings, error: holdErr } = await supabase
      .from('assistant_earnings')
      .update({
        status: 'held',
        updated_at: new Date().toISOString()
      })
      .in('id', selectedIds)
      .eq('status', 'available') // atomic concurrency guard
      .select();

    if (holdErr || !heldEarnings || heldEarnings.length !== selectedIds.length) {
      // Rollback payout if earnings were claimed concurrently
      await supabase.from('assistant_payouts').delete().eq('id', createdPayout.id);
      return res.status(409).json({ message: 'Concurrency conflict: Earnings are no longer available.' });
    }

    // 8. Create assistant_payout_items records linking each earning to the payout
    const payoutItems = selectedEarnings.map((e) => ({
      payout_id: createdPayout.id,
      earning_id: e.id,
      amount: Number(e.assistant_amount) || 0,
      created_at: new Date().toISOString()
    }));

    const { data: createdItems, error: itemsErr } = await supabase
      .from('assistant_payout_items')
      .insert(payoutItems)
      .select();

    if (itemsErr) {
      // Revert earnings back to available and delete payout
      await supabase
        .from('assistant_earnings')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .in('id', selectedIds);
      await supabase.from('assistant_payouts').delete().eq('id', createdPayout.id);

      return res.status(500).json({ message: 'Failed to record payout items: ' + itemsErr.message });
    }

    await auditService.recordFinancialAudit(supabase, {
      actor_id: assistantId,
      actor_role: 'assistant',
      action: 'payout_requested',
      entity_type: 'assistant_payout',
      entity_id: createdPayout.id,
      payout_id: createdPayout.id,
      amount: requestedAmount,
      previous_state: null,
      new_state: { status: 'requested' },
      metadata: { earning_ids: selectedIds }
    });

    emitWalletUpdate(assistantId, { payoutId: createdPayout.id, status: 'requested' });

    res.status(201).json({
      success: true,
      message: 'Payout request submitted successfully.',
      payout: createdPayout,
      items: createdItems
    });
  } catch (err) {
    console.error('REQUEST PAYOUT ERROR:', err);
    res.status(500).json({ message: 'Unable to process payout request.' });
  }
};

/**
 * POST /api/assistant-payouts/:id/cancel
 * Assistant cancels their own 'requested' payout.
 */
exports.cancelPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const assistantId = req.user.id;

    const { data: payout, error: fetchErr } = await supabase
      .from('assistant_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    const ruleCheck = payoutRules.canAssistantCancelPayout(payout, assistantId);
    if (!ruleCheck.allowed) {
      return res.status(400).json({ message: ruleCheck.reason });
    }

    // Fetch linked items
    const { data: items } = await supabase
      .from('assistant_payout_items')
      .select('earning_id')
      .eq('payout_id', id);

    const earningIds = (items || []).map((i) => i.earning_id);

    // Update payout status to cancelled
    const { data: updatedPayout, error: updateErr } = await supabase
      .from('assistant_payouts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ message: updateErr.message });
    }

    // Release linked earnings back to 'available' (skipping any already reversed)
    if (earningIds.length > 0) {
      await supabase
        .from('assistant_earnings')
        .update({
          status: 'available',
          updated_at: new Date().toISOString()
        })
        .in('id', earningIds)
        .eq('status', 'held');
    }

    await auditService.recordFinancialAudit(supabase, {
      actor_id: assistantId,
      actor_role: 'assistant',
      action: 'payout_cancelled',
      entity_type: 'assistant_payout',
      entity_id: id,
      payout_id: id,
      amount: payout.amount,
      previous_state: { status: payout.status },
      new_state: { status: 'cancelled' },
      metadata: { released_earning_ids: earningIds }
    });

    emitWalletUpdate(assistantId, { payoutId: id, status: 'cancelled' });

    res.json({
      success: true,
      message: 'Payout request cancelled successfully.',
      payout: updatedPayout
    });
  } catch (err) {
    console.error('CANCEL PAYOUT ERROR:', err);
    res.status(500).json({ message: 'Unable to cancel payout request.' });
  }
};

// --------------------------------------------------
// ADMIN ENDPOINTS
// --------------------------------------------------

/**
 * GET /api/admin/payouts
 * Admin views all payouts with optional status filter.
 */
exports.getAllPayouts = async (req, res) => {
  try {
    const { status, assistant_id } = req.query;

    let query = supabase
      .from('assistant_payouts')
      .select('*, assistant:assistant_id(id, name, email, phone, station_code), items:assistant_payout_items(*)')
      .order('created_at', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.eq('status', status.toLowerCase());
    }
    if (assistant_id) {
      query = query.eq('assistant_id', assistant_id);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.json({ success: true, payouts: data || [] });
  } catch (err) {
    console.error('ADMIN GET ALL PAYOUTS ERROR:', err);
    res.status(500).json({ message: 'Unable to load payouts.' });
  }
};

/**
 * GET /api/admin/payouts/:id
 * Admin views detailed payout by id.
 */
exports.getAdminPayoutById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: payout, error } = await supabase
      .from('assistant_payouts')
      .select('*, assistant:assistant_id(id, name, email, phone, station_code), items:assistant_payout_items(*, earning:earning_id(*))')
      .eq('id', id)
      .maybeSingle();

    if (error || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    res.json({ success: true, payout });
  } catch (err) {
    console.error('ADMIN GET PAYOUT BY ID ERROR:', err);
    res.status(500).json({ message: 'Unable to load payout details.' });
  }
};

/**
 * POST /api/admin/payouts/:id/approve
 * Admin approves a requested payout.
 */
exports.approvePayout = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: payout, error: fetchErr } = await supabase
      .from('assistant_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    // Idempotent check
    if (payout.status === 'approved') {
      return res.json({ success: true, message: 'Payout is already approved.', payout });
    }

    const ruleCheck = payoutRules.canAdminApprovePayout(payout);
    if (!ruleCheck.allowed) {
      return res.status(400).json({ message: ruleCheck.reason });
    }

    const { data: updatedPayout, error: updateErr } = await supabase
      .from('assistant_payouts')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ message: updateErr.message });
    }

    await auditService.recordFinancialAudit(supabase, {
      actor_id: req.user?.id || null,
      actor_role: req.user?.role || 'admin',
      action: 'payout_approved',
      entity_type: 'assistant_payout',
      entity_id: id,
      payout_id: id,
      amount: payout.amount,
      previous_state: { status: payout.status },
      new_state: { status: 'approved' }
    });

    emitWalletUpdate(payout.assistant_id, { payoutId: id, status: 'approved' });

    res.json({
      success: true,
      message: 'Payout approved successfully.',
      payout: updatedPayout
    });
  } catch (err) {
    console.error('ADMIN APPROVE PAYOUT ERROR:', err);
    res.status(500).json({ message: 'Unable to approve payout.' });
  }
};

/**
 * POST /api/admin/payouts/:id/reject
 * Admin rejects a payout request.
 */
exports.rejectPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Rejected by administrator' } = req.body;

    const { data: payout, error: fetchErr } = await supabase
      .from('assistant_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    if (payout.status === 'rejected') {
      return res.json({ success: true, message: 'Payout is already rejected.', payout });
    }

    const ruleCheck = payoutRules.canAdminRejectPayout(payout);
    if (!ruleCheck.allowed) {
      return res.status(400).json({ message: ruleCheck.reason });
    }

    // Fetch linked items
    const { data: items } = await supabase
      .from('assistant_payout_items')
      .select('earning_id')
      .eq('payout_id', id);

    const earningIds = (items || []).map((i) => i.earning_id);

    const { data: updatedPayout, error: updateErr } = await supabase
      .from('assistant_payouts')
      .update({
        status: 'rejected',
        failure_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ message: updateErr.message });
    }

    // Safely restore linked earnings from 'held' -> 'available' (skipping any 'reversed')
    if (earningIds.length > 0) {
      await supabase
        .from('assistant_earnings')
        .update({
          status: 'available',
          updated_at: new Date().toISOString()
        })
        .in('id', earningIds)
        .eq('status', 'held');
    }

    await auditService.recordFinancialAudit(supabase, {
      actor_id: req.user?.id || null,
      actor_role: req.user?.role || 'admin',
      action: 'payout_rejected',
      entity_type: 'assistant_payout',
      entity_id: id,
      payout_id: id,
      amount: payout.amount,
      previous_state: { status: payout.status },
      new_state: { status: 'rejected' },
      metadata: { reason, released_earning_ids: earningIds }
    });

    emitWalletUpdate(payout.assistant_id, { payoutId: id, status: 'rejected' });

    res.json({
      success: true,
      message: 'Payout rejected.',
      payout: updatedPayout
    });
  } catch (err) {
    console.error('ADMIN REJECT PAYOUT ERROR:', err);
    res.status(500).json({ message: 'Unable to reject payout.' });
  }
};

/**
 * POST /api/admin/payouts/:id/processing
 * Admin marks payout as processing.
 */
exports.markPayoutProcessing = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: payout, error: fetchErr } = await supabase
      .from('assistant_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    if (payout.status === 'processing') {
      return res.json({ success: true, message: 'Payout is already processing.', payout });
    }

    const ruleCheck = payoutRules.canMarkPayoutProcessing(payout);
    if (!ruleCheck.allowed) {
      return res.status(400).json({ message: ruleCheck.reason });
    }

    const { data: updatedPayout, error: updateErr } = await supabase
      .from('assistant_payouts')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ message: updateErr.message });
    }

    await auditService.recordFinancialAudit(supabase, {
      actor_id: req.user?.id || null,
      actor_role: req.user?.role || 'admin',
      action: 'payout_processing',
      entity_type: 'assistant_payout',
      entity_id: id,
      payout_id: id,
      amount: payout.amount,
      previous_state: { status: payout.status },
      new_state: { status: 'processing' }
    });

    emitWalletUpdate(payout.assistant_id, { payoutId: id, status: 'processing' });

    res.json({
      success: true,
      message: 'Payout marked as processing.',
      payout: updatedPayout
    });
  } catch (err) {
    console.error('ADMIN PROCESSING PAYOUT ERROR:', err);
    res.status(500).json({ message: 'Unable to update payout status.' });
  }
};

/**
 * POST /api/admin/payouts/:id/paid
 * Admin marks payout as paid and permanently finalizes linked earnings to 'paid_out'.
 * CRITICAL SAFETY: Verifies manual settlement fields, enforces HTTP 409 on duplicate references,
 * checks amount parity, ensures no linked earnings are 'reversed', and records tamper-evident audit logs.
 */
exports.markPayoutPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      payout_reference = null,
      payout_method = null,
      settlement_date = null,
      settlement_notes = null,
      gateway_payout_id = null
    } = req.body;

    const client = req.supabase || supabase;

    const { data: payout, error: fetchErr } = await client
      .from('assistant_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    // Idempotent check
    if (payout.status === 'paid') {
      return res.json({
        success: true,
        message: 'Payout is already marked paid.',
        payout,
        idempotent: true
      });
    }

    // Settlement input validation (mandatory reference, allowed method)
    const effectiveRef = payout_reference || payout.payout_reference;
    const effectiveMethod = payout_method || payout.payout_method || 'bank_transfer';
    const inputValidation = payoutRules.validatePayoutSettlementInput({
      payout_reference: effectiveRef,
      payout_method: effectiveMethod,
      settlement_date: settlement_date || payout.settlement_date,
      settlement_notes: settlement_notes || payout.settlement_notes
    });

    if (!inputValidation.valid) {
      return res.status(400).json({ message: inputValidation.error });
    }

    const cleanRef = inputValidation.sanitized.payout_reference;
    const cleanMethod = inputValidation.sanitized.payout_method;
    const cleanDate = inputValidation.sanitized.settlement_date || new Date().toISOString();
    const cleanNotes = inputValidation.sanitized.settlement_notes;

    // Check duplicate reference on already paid payouts (Enforce HTTP 409 Conflict)
    const { data: existingPaidWithRef } = await client
      .from('assistant_payouts')
      .select('id, payout_reference')
      .eq('payout_reference', cleanRef)
      .eq('status', 'paid')
      .neq('id', id)
      .maybeSingle();

    if (existingPaidWithRef) {
      return res.status(409).json({
        message: `Payout reference "${cleanRef}" has already been used for paid payout ID ${existingPaidWithRef.id}. Duplicate references are strictly forbidden.`
      });
    }

    // Fetch linked earnings to check for reversals and ownership
    const { data: items } = await supabase
      .from('assistant_payout_items')
      .select('*, earning:earning_id(*)')
      .eq('payout_id', id);

    const linkedEarnings = (items || []).map((i) => i.earning).filter(Boolean);

    // Enforce centralized payout rules, settlement verification & Phase 3A conflict safety
    const ruleCheck = payoutRules.canMarkPayoutPaid(payout, linkedEarnings, {
      payout_reference: cleanRef,
      payout_method: cleanMethod,
      settlement_date: cleanDate,
      settlement_notes: cleanNotes
    });
    if (!ruleCheck.allowed) {
      return res.status(400).json({ message: ruleCheck.reason });
    }

    // Check item sum match
    const totalItemAmount = (items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (Math.abs(totalItemAmount - Number(payout.amount)) > 0.01) {
      return res.status(400).json({
        message: `Payout amount mismatch: items sum (₹${totalItemAmount}) does not match payout amount (₹${payout.amount}).`
      });
    }

    const earningIds = (items || []).map((i) => i.earning_id);

    // Atomically mark payout as 'paid'
    const { data: updatedPayout, error: updateErr } = await supabase
      .from('assistant_payouts')
      .update({
        status: 'paid',
        payout_reference: cleanRef,
        payout_method: cleanMethod,
        settlement_date: cleanDate,
        settlement_notes: cleanNotes,
        gateway_payout_id: gateway_payout_id || payout.gateway_payout_id || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      if (updateErr.code === '23505' || (updateErr.message && updateErr.message.toLowerCase().includes('unique'))) {
        return res.status(409).json({
          message: `Payout reference "${cleanRef}" violates unique constraint on paid payouts.`
        });
      }
      return res.status(500).json({ message: updateErr.message });
    }

    // Atomically transition linked earnings: 'held' -> 'paid_out'
    if (earningIds.length > 0) {
      await supabase
        .from('assistant_earnings')
        .update({
          status: 'paid_out',
          updated_at: new Date().toISOString()
        })
        .in('id', earningIds)
        .eq('status', 'held');
    }

    // Phase 4 Audit Logging: Settlement recorded, payout paid, earnings paid out
    await auditService.recordFinancialAudit(supabase, {
      actor_id: req.user?.id || null,
      actor_role: req.user?.role || 'admin',
      action: 'payout_settlement_recorded',
      entity_type: 'assistant_payout',
      entity_id: id,
      payout_id: id,
      amount: updatedPayout.amount,
      previous_state: { status: payout.status },
      new_state: {
        status: 'paid',
        payout_reference: cleanRef,
        payout_method: cleanMethod,
        settlement_date: cleanDate
      },
      metadata: { settlement_notes: cleanNotes }
    });

    await auditService.recordFinancialAudit(supabase, {
      actor_id: req.user?.id || null,
      actor_role: req.user?.role || 'admin',
      action: 'payout_paid',
      entity_type: 'assistant_payout',
      entity_id: id,
      payout_id: id,
      amount: updatedPayout.amount,
      previous_state: { status: payout.status },
      new_state: { status: 'paid' },
      metadata: { reference: cleanRef, method: cleanMethod }
    });

    for (const earn of linkedEarnings) {
      await auditService.recordFinancialAudit(supabase, {
        actor_id: req.user?.id || null,
        actor_role: req.user?.role || 'admin',
        action: 'earning_paid_out',
        entity_type: 'assistant_earning',
        entity_id: earn.id,
        payout_id: id,
        earning_id: earn.id,
        booking_id: earn.booking_id,
        amount: earn.assistant_amount,
        previous_state: { status: earn.status },
        new_state: { status: 'paid_out' },
        metadata: { payout_id: id }
      });
    }

    emitWalletUpdate(payout.assistant_id, { payoutId: id, status: 'paid' });

    res.json({
      success: true,
      message: 'Payout marked as paid and earnings finalized.',
      payout: updatedPayout
    });
  } catch (err) {
    console.error('ADMIN MARK PAID ERROR:', err);
    res.status(500).json({ message: 'Unable to finalize payout.' });
  }
};

/**
 * POST /api/admin/payouts/:id/failed
 * Admin marks payout as failed. Safely restores unreversed earnings to 'available'.
 */
exports.markPayoutFailed = async (req, res) => {
  try {
    const { id } = req.params;
    const { failure_reason = 'Payout transaction failed' } = req.body;

    const { data: payout, error: fetchErr } = await supabase
      .from('assistant_payouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !payout) {
      return res.status(404).json({ message: 'Payout not found.' });
    }

    if (payout.status === 'failed') {
      return res.json({ success: true, message: 'Payout is already marked failed.', payout });
    }

    const ruleCheck = payoutRules.canMarkPayoutFailed(payout);
    if (!ruleCheck.allowed) {
      return res.status(400).json({ message: ruleCheck.reason });
    }

    // Fetch linked items
    const { data: items } = await supabase
      .from('assistant_payout_items')
      .select('earning_id')
      .eq('payout_id', id);

    const earningIds = (items || []).map((i) => i.earning_id);

    const { data: updatedPayout, error: updateErr } = await supabase
      .from('assistant_payouts')
      .update({
        status: 'failed',
        failure_reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ message: updateErr.message });
    }

    // Safely restore linked earnings to 'available' (skipping any 'reversed')
    if (earningIds.length > 0) {
      await supabase
        .from('assistant_earnings')
        .update({
          status: 'available',
          updated_at: new Date().toISOString()
        })
        .in('id', earningIds)
        .eq('status', 'held');
    }

    await auditService.recordFinancialAudit(supabase, {
      actor_id: req.user?.id || null,
      actor_role: req.user?.role || 'admin',
      action: 'payout_failed',
      entity_type: 'assistant_payout',
      entity_id: id,
      payout_id: id,
      amount: payout.amount,
      previous_state: { status: payout.status },
      new_state: { status: 'failed' },
      metadata: { failure_reason, restored_earning_ids: earningIds }
    });

    emitWalletUpdate(payout.assistant_id, { payoutId: id, status: 'failed' });

    res.json({
      success: true,
      message: 'Payout marked as failed. Earnings returned to available.',
      payout: updatedPayout
    });
  } catch (err) {
    console.error('ADMIN MARK FAILED ERROR:', err);
    res.status(500).json({ message: 'Unable to update payout status.' });
  }
};

module.exports.setIO = setIO;
