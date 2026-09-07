/**
 * server/src/config/payoutRules.js
 *
 * Centralized Payout Rules Engine (Phase 3B)
 *
 * Validates payout amounts, assistant request eligibility, admin state transitions,
 * and guards against paying reversed or conflicting earnings.
 */

const DEFAULT_MINIMUM_PAYOUT_AMOUNT = 100;

/**
 * Returns the configured minimum payout threshold.
 * @returns {number}
 */
function getMinimumPayoutAmount() {
  const envVal = process.env.MINIMUM_PAYOUT_AMOUNT;
  if (envVal !== undefined && envVal !== null && envVal !== '') {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MINIMUM_PAYOUT_AMOUNT;
}

/**
 * Validates whether the amount is a valid positive financial value.
 * @param {number|string} amount
 * @returns {boolean}
 */
function isValidPayoutAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && isFinite(num) && num > 0;
}

/**
 * Evaluates whether an assistant is eligible to request a payout for the specified amount.
 * @param {number} availableBalance
 * @param {number} requestedAmount
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canAssistantRequestPayout(availableBalance, requestedAmount) {
  if (!isValidPayoutAmount(requestedAmount)) {
    return { allowed: false, reason: 'Requested amount must be a positive number greater than zero.' };
  }

  const minAmount = getMinimumPayoutAmount();
  const reqNum = Math.round(Number(requestedAmount) * 100) / 100;
  const availNum = Math.round(Number(availableBalance || 0) * 100) / 100;

  if (reqNum < minAmount) {
    return {
      allowed: false,
      reason: `Minimum payout withdrawal amount is ₹${minAmount}. Requested: ₹${reqNum}.`
    };
  }

  if (reqNum > availNum) {
    return {
      allowed: false,
      reason: `Requested amount (₹${reqNum}) exceeds your authoritative available balance (₹${availNum}).`
    };
  }

  return { allowed: true };
}

/**
 * Checks if admin can approve a payout request.
 * Allowed from: 'requested'
 * @param {object} payout
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canAdminApprovePayout(payout) {
  if (!payout) return { allowed: false, reason: 'Payout record required.' };
  if (payout.status !== 'requested') {
    return { allowed: false, reason: `Cannot approve payout in '${payout.status}' status.` };
  }
  return { allowed: true };
}

/**
 * Checks if admin can reject a payout request.
 * Allowed from: 'requested', 'approved'
 * @param {object} payout
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canAdminRejectPayout(payout) {
  if (!payout) return { allowed: false, reason: 'Payout record required.' };
  if (!['requested', 'approved'].includes(payout.status)) {
    return { allowed: false, reason: `Cannot reject payout in '${payout.status}' status.` };
  }
  return { allowed: true };
}

/**
 * Checks if admin can mark a payout as processing.
 * Allowed from: 'approved', 'requested'
 * @param {object} payout
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canMarkPayoutProcessing(payout) {
  if (!payout) return { allowed: false, reason: 'Payout record required.' };
  if (!['approved', 'requested'].includes(payout.status)) {
    return { allowed: false, reason: `Cannot move payout to processing from '${payout.status}' status.` };
  }
  return { allowed: true };
}

const ALLOWED_PAYOUT_METHODS = ['upi', 'imps', 'neft', 'bank_transfer', 'cash', 'other'];

/**
 * Validates manual settlement input provided by admin during payout finalization (Phase 4).
 * @param {object} input
 * @returns {{ valid: boolean, reason?: string, normalizedMethod?: string }}
 */
function validatePayoutSettlementInput(input) {
  if (!input) {
    return { valid: false, error: 'Settlement details are required.', reason: 'Settlement details are required.' };
  }

  // 1. Validate payout_reference
  const ref = typeof input.payout_reference === 'string' ? input.payout_reference.trim() : '';
  if (!ref) {
    return {
      valid: false,
      error: 'Payout reference is mandatory and cannot be empty.',
      reason: 'Payout reference is mandatory and cannot be empty.'
    };
  }
  if (ref.length < 3 || ref.length > 100) {
    return {
      valid: false,
      error: 'Payout reference must be between 3 and 100 characters.',
      reason: 'Payout reference must be between 3 and 100 characters.'
    };
  }

  // 2. Validate payout_method
  const rawMethod = typeof input.payout_method === 'string' ? input.payout_method.trim().toLowerCase() : '';
  if (!rawMethod) {
    return {
      valid: false,
      error: 'Payout method is required.',
      reason: 'Payout method is required.'
    };
  }
  if (!ALLOWED_PAYOUT_METHODS.includes(rawMethod)) {
    const msg = `Invalid payout method '${rawMethod}'. Allowed methods: ${ALLOWED_PAYOUT_METHODS.join(', ')}.`;
    return {
      valid: false,
      error: msg,
      reason: msg
    };
  }

  const sanitized = {
    payout_reference: ref,
    payout_method: rawMethod,
    settlement_date: input.settlement_date ? new Date(input.settlement_date).toISOString() : new Date().toISOString(),
    settlement_notes: typeof input.settlement_notes === 'string' && input.settlement_notes.trim() ? input.settlement_notes.trim() : null
  };

  return {
    valid: true,
    normalizedMethod: rawMethod,
    sanitized
  };
}

/**
 * Checks if admin can mark a payout as paid.
 * Allowed from: 'processing', 'approved'
 * CRITICAL INVARIANTS:
 * 1. Rejects if ANY linked earning is in 'reversed' status.
 * 2. Rejects if ANY linked earning is NOT in 'held' status.
 * 3. Rejects if any linked earning belongs to another assistant.
 * 4. Rejects if settlement details (reference, method) are invalid.
 *
 * @param {object} payout
 * @param {Array<object>} [linkedEarnings=[]]
 * @param {object} [settlementInput=null]
 * @returns {{ allowed: boolean, reason?: string, normalizedMethod?: string }}
 */
function canMarkPayoutPaid(payout, linkedEarnings = [], settlementInput = null) {
  if (!payout) return { allowed: false, reason: 'Payout record required.' };
  if (!['processing', 'approved'].includes(payout.status)) {
    return { allowed: false, reason: `Cannot mark payout paid from '${payout.status}' status.` };
  }

  // Settlement input validation (Phase 4 requirement)
  if (settlementInput !== null) {
    const val = validatePayoutSettlementInput(settlementInput);
    if (!val.valid) {
      return { allowed: false, reason: val.reason };
    }
  }

  // Phase 3A/3B Conflict Safety Guard: No reversed earnings or reversed flag
  const hasReversed = linkedEarnings.some((e) => e && (e.status === 'reversed' || e.is_reversed === true || e.reversed_at));
  if (hasReversed) {
    return {
      allowed: false,
      reason: 'CRITICAL: One or more earnings linked to this payout have been reversed due to cancellation or refund. Payout cannot be disbursed.'
    };
  }

  // Phase 4 Held Status Guard: In strict settlement mode, linked earnings must be 'held'
  if (settlementInput !== null && linkedEarnings.length > 0) {
    const nonHeld = linkedEarnings.some((e) => e && e.status !== 'held');
    if (nonHeld) {
      return {
        allowed: false,
        reason: "CRITICAL: All linked earnings must be in 'held' status before payout can be finalized to paid."
      };
    }
  }

  // Phase 4 Cross-Assistant Injection Guard
  if (payout.assistant_id) {
    const crossAssistant = linkedEarnings.some((e) => e && e.assistant_id && e.assistant_id !== payout.assistant_id);
    if (crossAssistant) {
      return {
        allowed: false,
        reason: 'CRITICAL: Security violation - payout contains earnings belonging to another assistant.'
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks if admin can mark a payout as failed.
 * Allowed from: 'processing', 'approved'
 * @param {object} payout
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canMarkPayoutFailed(payout) {
  if (!payout) return { allowed: false, reason: 'Payout record required.' };
  if (!['processing', 'approved'].includes(payout.status)) {
    return { allowed: false, reason: `Cannot mark payout failed from '${payout.status}' status.` };
  }
  return { allowed: true };
}

/**
 * Checks if an assistant can cancel their own requested payout.
 * Allowed strictly when payout belongs to the assistant and is still in 'requested' state.
 * @param {object} payout
 * @param {string} assistantId
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canAssistantCancelPayout(payout, assistantId) {
  if (!payout) return { allowed: false, reason: 'Payout record required.' };
  if (payout.assistant_id !== assistantId) {
    return { allowed: false, reason: 'Unauthorized: You do not own this payout request.' };
  }
  if (payout.status !== 'requested') {
    return { allowed: false, reason: `Cannot cancel payout once it is '${payout.status}'. Contact administrator.` };
  }
  return { allowed: true };
}

module.exports = {
  ALLOWED_PAYOUT_METHODS,
  getMinimumPayoutAmount,
  isValidPayoutAmount,
  validatePayoutSettlementInput,
  canAssistantRequestPayout,
  canAdminApprovePayout,
  canAdminRejectPayout,
  canMarkPayoutProcessing,
  canMarkPayoutPaid,
  canMarkPayoutFailed,
  canAssistantCancelPayout,
};
