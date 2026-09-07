/**
 * server/src/utils/auditService.js
 *
 * Immutable Financial Audit Trail Service (Phase 4)
 *
 * Records append-only, tamper-evident audit log entries for all significant
 * financial transactions across payments, refunds, earnings, payouts, and reconciliation.
 */

/**
 * Inserts an immutable financial audit log entry into financial_audit_logs.
 *
 * @param {object} supabase - Supabase client
 * @param {object} auditData
 * @param {string} [auditData.actor_id] - User ID who triggered the action
 * @param {string} [auditData.actor_role] - Role ('admin', 'assistant', 'passenger', 'system')
 * @param {string} auditData.action - Action identifier (e.g. 'payout_settlement_recorded')
 * @param {string} auditData.entity_type - Type ('payout', 'payment', 'refund', 'earning', 'reconciliation')
 * @param {string} [auditData.entity_id]
 * @param {string} [auditData.booking_id]
 * @param {string} [auditData.payment_id]
 * @param {string} [auditData.payout_id]
 * @param {string} [auditData.earning_id]
 * @param {string} [auditData.refund_id]
 * @param {number} [auditData.amount]
 * @param {string} [auditData.currency='INR']
 * @param {object} [auditData.previous_state={}]
 * @param {object} [auditData.new_state={}]
 * @param {object} [auditData.metadata={}]
 * @returns {Promise<{ success: boolean, log?: object, error?: object }>}
 */
async function recordFinancialAudit(supabase, auditData) {
  if (!auditData || !auditData.action || !auditData.entity_type) {
    return { success: false, error: { message: 'action and entity_type are required for financial audit.' } };
  }

  const record = {
    actor_id: auditData.actor_id || null,
    actor_role: auditData.actor_role || 'system',
    action: auditData.action,
    entity_type: auditData.entity_type,
    entity_id: auditData.entity_id || null,
    booking_id: auditData.booking_id || null,
    payment_id: auditData.payment_id || null,
    payout_id: auditData.payout_id || null,
    earning_id: auditData.earning_id || null,
    refund_id: auditData.refund_id || null,
    amount: auditData.amount !== undefined && auditData.amount !== null ? Number(auditData.amount) : null,
    currency: auditData.currency || 'INR',
    previous_state: typeof auditData.previous_state === 'object' ? auditData.previous_state : {},
    new_state: typeof auditData.new_state === 'object' ? auditData.new_state : {},
    metadata: typeof auditData.metadata === 'object' ? auditData.metadata : {},
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('financial_audit_logs')
      .insert([record])
      .select()
      .single();

    if (error) {
      console.warn('[FINANCIAL AUDIT] Insert notice (table may be pending migration):', error.message);
      return { success: false, error };
    }

    return { success: true, log: data };
  } catch (err) {
    console.warn('[FINANCIAL AUDIT] Exception:', err.message);
    return { success: false, error: { message: err.message } };
  }
}

/**
 * Convenience helper to log payout events
 */
async function logPayoutEvent(supabase, action, payout, actor, extra = {}) {
  return recordFinancialAudit(supabase, {
    actor_id: actor?.id || null,
    actor_role: actor?.role || 'admin',
    action,
    entity_type: 'payout',
    entity_id: payout?.id,
    payout_id: payout?.id,
    amount: payout?.amount,
    previous_state: extra.previous_state || {},
    new_state: extra.new_state || (payout ? { status: payout.status } : {}),
    metadata: {
      payout_reference: payout?.payout_reference,
      payout_method: payout?.payout_method,
      assistant_id: payout?.assistant_id,
      ...extra.metadata
    }
  });
}

/**
 * Convenience helper to log earning events
 */
async function logEarningEvent(supabase, action, earning, actor, extra = {}) {
  return recordFinancialAudit(supabase, {
    actor_id: actor?.id || null,
    actor_role: actor?.role || 'system',
    action,
    entity_type: 'earning',
    entity_id: earning?.id,
    earning_id: earning?.id,
    booking_id: earning?.booking_id,
    payment_id: earning?.payment_id,
    amount: earning?.assistant_amount,
    previous_state: extra.previous_state || {},
    new_state: extra.new_state || (earning ? { status: earning.status } : {}),
    metadata: {
      assistant_id: earning?.assistant_id,
      platform_commission_amount: earning?.platform_commission_amount,
      ...extra.metadata
    }
  });
}

module.exports = {
  recordFinancialAudit,
  logPayoutEvent,
  logEarningEvent,
};
