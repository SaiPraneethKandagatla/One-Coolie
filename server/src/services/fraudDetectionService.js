/**
 * server/src/services/fraudDetectionService.js
 *
 * Fraud & Anomaly Detection Engine (Phase 5)
 *
 * Evaluates financial events and ledger states against 5 core anomaly rules:
 *  Rule 1: Rapid Payment Attempts (Repeated failed payment attempts)
 *  Rule 2: Excessive Refund Activity (Unusual refund frequency or amount)
 *  Rule 3: Rapid Booking Cancellation (Pay -> Cancel -> Refund churn)
 *  Rule 4: Payout Anomaly (Unusual amount, repeated failures, churn)
 *  Rule 5: Financial State Corruption (Phase 4 reconciliation invariant violations)
 *
 * Enforces strict Idempotent Deduplication: Active (open/investigating) incidents
 * are updated with newer telemetry rather than spawning duplicate records.
 */

let io = null;

function setIO(ioInstance) {
  io = ioInstance;
}

function broadcastIncident(event, incident) {
  if (!io || !incident) return;
  try {
    io.to('admin_room').emit(event, {
      incidentId: incident.id,
      severity: incident.severity,
      incidentType: incident.incident_type,
      title: incident.title,
      status: incident.status,
      detectedAt: incident.detected_at || incident.created_at
    });
  } catch (err) {
    console.warn('Socket emit incident event error:', err.message);
  }
}

/**
 * Creates or deduplicates a financial incident.
 * If an active (open or investigating) incident for the same type & entity already exists,
 * updates metadata and timestamp instead of creating duplicate records.
 *
 * @param {object} supabase
 * @param {object} incidentData
 * @returns {Promise<{ created: boolean, deduplicated: boolean, incident: object }>}
 */
async function recordOrDeduplicateIncident(supabase, incidentData) {
  const {
    incident_type,
    severity = 'warning',
    title,
    description,
    entity_type = null,
    entity_id = null,
    booking_id = null,
    payment_id = null,
    refund_id = null,
    payout_id = null,
    assistant_id = null,
    passenger_id = null,
    user_id = null,
    metadata = {}
  } = incidentData;

  const effBookingId = booking_id || (entity_type === 'booking' ? entity_id : null);
  const effPaymentId = payment_id || (entity_type === 'payment' ? entity_id : null);
  const effRefundId = refund_id || (entity_type === 'refund' ? entity_id : null);
  const effPayoutId = payout_id || (entity_type === 'assistant_payout' || entity_type === 'payout' ? entity_id : null);
  const effPassengerId = passenger_id || (entity_type === 'passenger' || entity_type === 'user' ? entity_id : user_id);
  const effAssistantId = assistant_id || (entity_type === 'assistant' ? entity_id : null);

  // 1. Query for existing active unresolved incident
  let query = supabase
    .from('financial_incidents')
    .select('*')
    .eq('incident_type', incident_type)
    .in('status', ['open', 'investigating']);

  if (effBookingId) query = query.eq('booking_id', effBookingId);
  else if (effPaymentId) query = query.eq('payment_id', effPaymentId);
  else if (effPayoutId) query = query.eq('payout_id', effPayoutId);
  else if (effRefundId) query = query.eq('refund_id', effRefundId);
  else if (effPassengerId) query = query.eq('passenger_id', effPassengerId);
  else if (effAssistantId) query = query.eq('assistant_id', effAssistantId);
  else if (entity_id) query = query.eq('entity_id', entity_id);

  const { data: existingIncidents } = await query;
  const existing = Array.isArray(existingIncidents) && existingIncidents.length > 0 ? existingIncidents[0] : null;

  if (existing) {
    // Deduplicate: update existing active incident
    const previousCount = Number(existing.occurrence_count || existing.metadata?.occurrence_count || 1);
    const newCount = previousCount + 1;
    const updatedMetadata = {
      ...(existing.metadata || {}),
      ...metadata,
      occurrence_count: newCount,
      last_occurrence: new Date().toISOString()
    };

    const { data: updated, error: updateErr } = await supabase
      .from('financial_incidents')
      .update({
        occurrence_count: newCount,
        metadata: updatedMetadata,
        detected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    const finalIncident = {
      ...existing,
      ...(updated || {}),
      occurrence_count: newCount,
      metadata: updatedMetadata
    };

    broadcastIncident('financial_incident_updated', finalIncident);
    return { created: false, deduplicated: true, incident: finalIncident };
  }

  // 2. Create new incident
  const newIncidentPayload = {
    incident_type,
    severity,
    status: 'open',
    title,
    description,
    entity_type,
    entity_id,
    booking_id: effBookingId,
    payment_id: effPaymentId,
    refund_id: effRefundId,
    payout_id: effPayoutId,
    assistant_id: effAssistantId,
    passenger_id: effPassengerId,
    occurrence_count: 1,
    metadata: {
      ...metadata,
      occurrence_count: 1,
      first_detected: new Date().toISOString()
    },
    detected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: created, error: createErr } = await supabase
    .from('financial_incidents')
    .insert([newIncidentPayload])
    .select()
    .maybeSingle();

  if (createErr) {
    console.error('Failed to create financial incident:', createErr.message);
    return { created: false, deduplicated: false, error: createErr.message };
  }

  const finalCreated = created || newIncidentPayload;
  broadcastIncident('financial_incident_created', finalCreated);
  return { created: true, deduplicated: false, incident: finalCreated };
}

// ----------------------------------------------------------------------
// ANOMALY RULE IMPLEMENTATIONS
// ----------------------------------------------------------------------

/**
 * RULE 1 — Rapid Payment Attempts (Repeated failed payment attempts)
 * @param {object} supabase
 * @param {object} params
 */
async function checkRepeatedPaymentFailures(supabase, { passenger_id, booking_id, recentFailuresCount = 3 }) {
  if (!passenger_id && !booking_id) return null;

  // Check failed payments in the last 15 minutes
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let query = supabase
    .from('payments')
    .select('id, amount, status, created_at')
    .eq('status', 'failed')
    .gte('created_at', windowStart);

  if (passenger_id) query = query.eq('passenger_id', passenger_id);
  if (booking_id) query = query.eq('booking_id', booking_id);

  const { data: failedPayments = [] } = await query;
  const count = (failedPayments || []).length;

  if (count >= recentFailuresCount) {
    return await recordOrDeduplicateIncident(supabase, {
      incident_type: 'repeated_payment_failures',
      severity: 'warning',
      title: `Repeated Payment Failures Detected (${count} attempts in 15m)`,
      description: `User or booking encountered ${count} failed payment attempts within a 15-minute window. Potential card testing or gateway communication issue.`,
      passenger_id,
      booking_id,
      metadata: {
        failed_attempts_count: count,
        window_minutes: 15,
        recent_payment_ids: failedPayments.map((p) => p.id)
      }
    });
  }
  return null;
}

/**
 * RULE 2 — Excessive Refund Activity (Frequency or unusual amount)
 * @param {object} supabase
 * @param {object} params
 */
async function checkUnusualRefundActivity(supabase, { passenger_id, refund_amount, refund_id, booking_id }) {
  if (!passenger_id && !booking_id) return null;

  // 1. High value refund check (> ₹2,000 for standard luggage trip)
  const isHighValue = Number(refund_amount) >= 2000;

  // 2. Frequency check (2 or more refunds in 24 hours)
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('refunds')
    .select('id, amount, status, created_at')
    .gte('created_at', windowStart);

  if (passenger_id) query = query.eq('passenger_id', passenger_id);

  const { data: recentRefunds = [] } = await query;
  const count = (recentRefunds || []).length;

  if (isHighValue || count >= 2) {
    const severity = Number(refund_amount) >= 5000 ? 'critical' : 'warning';
    return await recordOrDeduplicateIncident(supabase, {
      incident_type: 'unusual_refund_activity',
      severity,
      title: isHighValue
        ? `High-Value Refund Requested (₹${refund_amount})`
        : `Frequent Refund Activity (${count} refunds in 24h)`,
      description: isHighValue
        ? `A refund of ₹${refund_amount} exceeds normal platform threshold (₹2,000).`
        : `Passenger initiated ${count} refunds within a 24-hour window.`,
      passenger_id,
      booking_id,
      refund_id,
      entity_type: 'refund',
      entity_id: refund_id,
      metadata: {
        refund_amount,
        recent_refunds_count: count,
        is_high_value: isHighValue
      }
    });
  }
  return null;
}

/**
 * RULE 3 — Rapid Paid Booking Cancellation (Pay -> Cancel -> Refund churn)
 * @param {object} supabase
 * @param {object} params
 */
async function checkRepeatedPaidCancellations(supabase, { passenger_id, threshold = 3 }) {
  if (!passenger_id) return null;

  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: cancelledBookings = [] } = await supabase
    .from('bookings')
    .select('id, status, payment_status, created_at')
    .eq('passenger_id', passenger_id)
    .eq('status', 'cancelled')
    .gte('created_at', windowStart);

  const count = (cancelledBookings || []).length;
  if (count >= threshold) {
    return await recordOrDeduplicateIncident(supabase, {
      incident_type: 'repeated_paid_cancellations',
      severity: 'warning',
      title: `Frequent Booking Cancellation Churn (${count} cancellations in 24h)`,
      description: `Passenger has cancelled ${count} bookings within 24 hours. Evaluated for potential booking hoarding or automated script activity.`,
      passenger_id,
      metadata: {
        cancelled_count: count,
        window_hours: 24,
        booking_ids: cancelledBookings.map((b) => b.id)
      }
    });
  }
  return null;
}

/**
 * RULE 4 — Payout Anomaly Detection
 * @param {object} supabase
 * @param {object} params
 */
async function checkPayoutAnomaly(supabase, { assistant_id, payout_id, amount, failure_reason = null, is_cancelled = false }) {
  if (!assistant_id) return null;

  // 4A: Unusual payout amount (> ₹5,000 for individual withdrawal)
  if (Number(amount) >= 5000) {
    return await recordOrDeduplicateIncident(supabase, {
      incident_type: 'unusual_payout_amount',
      severity: 'warning',
      title: `Unusually Large Payout Requested (₹${amount})`,
      description: `Sahayak requested a payout of ₹${amount}, exceeding standard single withdrawal advisory threshold (₹5,000).`,
      assistant_id,
      payout_id,
      metadata: { amount, advisory_threshold: 5000 }
    });
  }

  // 4B: Repeated failed payout attempts
  if (failure_reason) {
    const { data: failedPayouts = [] } = await supabase
      .from('assistant_payouts')
      .select('id, amount, failure_reason')
      .eq('assistant_id', assistant_id)
      .eq('status', 'failed');

    if ((failedPayouts || []).length >= 2) {
      return await recordOrDeduplicateIncident(supabase, {
        incident_type: 'repeated_payout_failures',
        severity: 'warning',
        title: `Repeated Sahayak Payout Failures (${failedPayouts.length} failures)`,
        description: `Assistant has experienced ${failedPayouts.length} payout failures. Possible invalid bank IFSC/account details or bank network rejection.`,
        assistant_id,
        payout_id,
        metadata: {
          failure_count: failedPayouts.length,
          last_failure_reason: failure_reason
        }
      });
    }
  }

  // 4C: Repeated request -> cancel churn (3 or more cancellations)
  if (is_cancelled) {
    const { data: cancelledPayouts = [] } = await supabase
      .from('assistant_payouts')
      .select('id')
      .eq('assistant_id', assistant_id)
      .eq('status', 'cancelled');

    if ((cancelledPayouts || []).length >= 3) {
      return await recordOrDeduplicateIncident(supabase, {
        incident_type: 'payout_request_churn',
        severity: 'warning',
        title: `Sahayak Payout Request Churn (${cancelledPayouts.length} cancellations)`,
        description: `Assistant has created and cancelled ${cancelledPayouts.length} payout requests. Potential wallet balance thrashing.`,
        assistant_id,
        payout_id,
        metadata: { cancelled_payouts_count: cancelledPayouts.length }
      });
    }
  }

  return null;
}

/**
 * RULE 5 — Financial State Corruption Ingestion from Phase 4 Reconciliation Engine
 * Ingests reconciliation issues and spawns or updates deduplicated critical incidents.
 *
 * @param {object} supabase
 * @param {Array<object>} reconciliationIssues
 * @returns {Promise<Array<object>>} Created/updated incidents
 */
async function ingestReconciliationIssues(supabase, reconciliationIssues = []) {
  const recorded = [];
  const typeMap = {
    SPLIT_MISMATCH: { type: 'financial_solvency_discrepancy', severity: 'critical', title: 'Fare Split Mismatch Detected' },
    OVER_REFUND: { type: 'over_refund_detected', severity: 'critical', title: 'Over-Refund Invariant Breach' },
    PAID_OUT_AND_REVERSED: { type: 'payout_state_mismatch', severity: 'critical', title: 'Earning State Conflict (Paid Out & Reversed)' },
    PAYOUT_EARNING_NOT_FINALIZED: { type: 'payout_state_mismatch', severity: 'critical', title: 'Payout Paid with Unfinalized Earning' },
    ORPHANED_HELD_EARNING: { type: 'payout_state_mismatch', severity: 'critical', title: 'Orphaned Held Earning Detected' },
    CROSS_ASSISTANT_EARNING: { type: 'duplicate_earning_claim', severity: 'critical', title: 'Cross-Assistant Earning Security Violation' },
    DUPLICATE_EARNING_CLAIM: { type: 'duplicate_earning_claim', severity: 'critical', title: 'Duplicate Earning Claim on Payout' },
    UNPAID_ONLINE_CONFIRMED: { type: 'online_payment_gate_breach', severity: 'critical', title: 'Unpaid Online Booking Confirmed' },
    RADAR_LEAK_ONLINE_UNPAID: { type: 'online_payment_gate_breach', severity: 'critical', title: 'Unpaid Online Booking Leaked to Assistant Radar' },
    PAID_OUT_DRIFT: { type: 'financial_solvency_discrepancy', severity: 'warning', title: 'Ledger Paid Out Balance Drift' }
  };

  for (const issue of reconciliationIssues) {
    const mapping = typeMap[issue.code] || {
      type: 'reconciliation_invariant_violation',
      severity: issue.severity || 'critical',
      title: `Reconciliation Invariant Issue: ${issue.code}`
    };

    const incidentResult = await recordOrDeduplicateIncident(supabase, {
      incident_type: mapping.type,
      severity: mapping.severity,
      title: mapping.title,
      description: issue.message,
      entity_type: issue.entity_type,
      entity_id: issue.entity_id,
      booking_id: issue.entity_type === 'booking' ? issue.entity_id : issue.details?.bookingId || null,
      payment_id: issue.entity_type === 'payment' ? issue.entity_id : issue.details?.paymentId || null,
      payout_id: (issue.entity_type === 'assistant_payout' || issue.entity_type === 'payout') ? issue.entity_id : issue.details?.payoutId || null,
      metadata: {
        reconciliation_issue_code: issue.code,
        issue_details: issue.details,
        timestamp: issue.timestamp
      }
    });

    if (incidentResult?.incident) {
      recorded.push(incidentResult.incident);
    }
  }

  return recorded;
}

module.exports = {
  setIO,
  recordOrDeduplicateIncident,
  checkRepeatedPaymentFailures,
  checkUnusualRefundActivity,
  checkRepeatedPaidCancellations,
  checkPayoutAnomaly,
  ingestReconciliationIssues
};
