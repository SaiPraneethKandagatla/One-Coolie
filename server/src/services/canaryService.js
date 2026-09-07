/**
 * server/src/services/canaryService.js
 *
 * Server-Authoritative Canary Operations & Automatic Safety Guard Service (Phases 9 & 10)
 *
 * Implements staged rollout management:
 * Stage 1: 'internal' (internal operators only)
 * Stage 2: 'limited' (allowed stations & verified users)
 * Stage 3: 'percentage' (gradual percentage traffic)
 * Stage 4: 'public' (full production availability)
 *
 * AUTOMATIC SAFETY GUARD:
 * Automatically transitions to 'blocked' upon detection of:
 * - Critical unresolved financial incidents
 * - Financial reconciliation critical failures
 * - High refund anomalies or low payment success rates
 *
 * ZERO CLIENT TRUST: Eligibility is computed exclusively on the server.
 */

const { recordFinancialAudit } = require('../utils/auditService');
const { calculateCanaryMetrics, getCanaryThresholds } = require('./canaryMetricsService');

// Authoritative Canary State Configuration
let canaryState = {
  enabled: process.env.CANARY_ENABLED === 'true' || false,
  stage: process.env.CANARY_STAGE || 'disabled', // 'disabled' | 'internal' | 'limited' | 'percentage' | 'public' | 'blocked'
  previousStage: null,
  percentage: Number(process.env.CANARY_PERCENTAGE || 10),
  maxBookings: Number(process.env.CANARY_MAX_BOOKINGS || 100),
  allowedStations: (process.env.CANARY_ALLOWED_STATIONS || 'SC,BZA,KZJ,WL').split(',').map((s) => s.trim().toUpperCase()),
  blockedReason: null,
  blockedAt: null,
  lastEvaluatedAt: new Date().toISOString()
};

/**
 * Returns the current Canary configuration and state.
 */
function getCanaryState() {
  return { ...canaryState };
}

/**
 * Evaluates whether a booking or passenger is eligible for the current canary stage.
 * SERVER-AUTHORITATIVE: Clients cannot influence or pass canary flags.
 */
function evaluateCanaryEligibility(user, bookingContext = {}) {
  if (!canaryState.enabled || canaryState.stage === 'disabled') {
    return {
      eligible: false,
      stage: canaryState.stage,
      reason: 'Canary rollout is currently disabled.'
    };
  }

  if (canaryState.stage === 'blocked') {
    return {
      eligible: false,
      stage: 'blocked',
      reason: `Canary rollout is automatically blocked: ${canaryState.blockedReason || 'Safety guard triggered.'}`
    };
  }

  if (canaryState.stage === 'public') {
    return { eligible: true, stage: 'public', reason: 'Public launch enabled for all passengers.' };
  }

  if (canaryState.stage === 'internal') {
    const isInternal = user && (user.role === 'admin' || user.role === 'assistant' || user.email?.endsWith('@railmitra.com') || user.email?.endsWith('@onecoolie.com'));
    return {
      eligible: Boolean(isInternal),
      stage: 'internal',
      reason: isInternal ? 'Internal operator access verified.' : 'Rollout restricted to internal operators in Stage 1.'
    };
  }

  if (canaryState.stage === 'limited') {
    const station = (bookingContext.station_code || bookingContext.station || '').toUpperCase();
    const stationAllowed = canaryState.allowedStations.includes(station);
    return {
      eligible: Boolean(user && stationAllowed),
      stage: 'limited',
      reason: stationAllowed ? `Station ${station} is eligible for limited canary.` : `Station ${station || 'N/A'} is outside limited rollout zones.`
    };
  }

  if (canaryState.stage === 'percentage') {
    const station = (bookingContext.station_code || bookingContext.station || '').toUpperCase();
    if (canaryState.allowedStations.length > 0 && !canaryState.allowedStations.includes(station)) {
      return { eligible: false, stage: 'percentage', reason: `Station ${station} is outside active rollout corridors.` };
    }

    const seed = String(user?.id || bookingContext.train_number || Date.now());
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % 100;
    const isWithinPercentage = bucket < canaryState.percentage;

    return {
      eligible: isWithinPercentage,
      stage: 'percentage',
      reason: isWithinPercentage ? `Selected within ${canaryState.percentage}% traffic bucket.` : `Outside active ${canaryState.percentage}% bucket.`
    };
  }

  return { eligible: false, stage: canaryState.stage, reason: 'Unknown canary stage.' };
}

/**
 * Evaluates Canary Health and triggers AUTOMATIC SAFETY GUARD if necessary.
 */
async function evaluateCanarySafetyGuard(supabase) {
  const metricsResult = await calculateCanaryMetrics(supabase);
  canaryState.lastEvaluatedAt = new Date().toISOString();

  if (!metricsResult.healthy) {
    if (canaryState.stage !== 'blocked') {
      canaryState.previousStage = canaryState.stage;
      canaryState.stage = 'blocked';
      canaryState.blockedReason = metricsResult.failure_reasons.join(' | ');
      canaryState.blockedAt = new Date().toISOString();

      await recordFinancialAudit(supabase, {
        actor_id: null,
        actor_role: 'system',
        action: 'canary_auto_blocked',
        entity_type: 'canary',
        metadata: {
          reasons: metricsResult.failure_reasons,
          previous_stage: canaryState.previousStage,
          blocked_at: canaryState.blockedAt
        }
      });
    }

    return { healthy: false, blocked: true, reasons: metricsResult.failure_reasons };
  }

  return { healthy: true, blocked: canaryState.stage === 'blocked', reasons: [] };
}

/**
 * Calculates authoritative Canary Metrics from database records.
 */
async function getCanaryMetrics(supabase) {
  const metricsResult = await calculateCanaryMetrics(supabase);
  return {
    ...metricsResult,
    canary_state: getCanaryState()
  };
}

/**
 * Enables Canary Rollout.
 */
async function enableCanary(supabase, adminId, { stage = 'internal', percentage = 10, maxBookings = 100 } = {}) {
  const prev = { ...canaryState };
  canaryState.enabled = true;
  canaryState.stage = stage;
  canaryState.percentage = Number(percentage) || 10;
  canaryState.maxBookings = Number(maxBookings) || 100;
  canaryState.blockedReason = null;
  canaryState.blockedAt = null;

  await recordFinancialAudit(supabase, {
    actor_id: adminId,
    actor_role: 'admin',
    action: 'canary_enabled',
    entity_type: 'canary',
    previous_state: prev,
    new_state: canaryState
  });

  return getCanaryState();
}

/**
 * Pauses Canary Rollout.
 */
async function pauseCanary(supabase, adminId, reason = 'Operator requested pause') {
  const prev = { ...canaryState };
  canaryState.enabled = false;
  canaryState.previousStage = canaryState.stage;
  canaryState.stage = 'disabled';
  canaryState.blockedReason = reason;

  await recordFinancialAudit(supabase, {
    actor_id: adminId,
    actor_role: 'admin',
    action: 'canary_paused',
    entity_type: 'canary',
    previous_state: prev,
    new_state: canaryState,
    metadata: { reason }
  });

  return getCanaryState();
}

/**
 * Resumes Canary Rollout.
 */
async function resumeCanary(supabase, adminId) {
  const guard = await evaluateCanarySafetyGuard(supabase);
  if (!guard.healthy) {
    throw new Error(`Cannot resume canary: Active safety guard violations detected (${guard.reasons.join('; ')}).`);
  }

  const prev = { ...canaryState };
  canaryState.enabled = true;
  canaryState.stage = canaryState.previousStage || 'internal';
  canaryState.blockedReason = null;
  canaryState.blockedAt = null;

  await recordFinancialAudit(supabase, {
    actor_id: adminId,
    actor_role: 'admin',
    action: 'canary_resumed',
    entity_type: 'canary',
    previous_state: prev,
    new_state: canaryState
  });

  return getCanaryState();
}

/**
 * Explicit stage transitions with server-side safety checks.
 */
async function transitionToInternal(supabase, adminId) {
  const guard = await evaluateCanarySafetyGuard(supabase);
  if (!guard.healthy) {
    throw new Error(`Cannot transition canary: Safety guard blocked (${guard.reasons.join('; ')}).`);
  }
  return enableCanary(supabase, adminId, { stage: 'internal' });
}

async function transitionToLimited(supabase, adminId, stations = ['SC', 'BZA', 'KZJ', 'WL']) {
  const guard = await evaluateCanarySafetyGuard(supabase);
  if (!guard.healthy) {
    throw new Error(`Cannot transition canary: Safety guard blocked (${guard.reasons.join('; ')}).`);
  }
  canaryState.allowedStations = stations;
  return enableCanary(supabase, adminId, { stage: 'limited' });
}

async function transitionToPercentage(supabase, adminId, percentage = 25) {
  const guard = await evaluateCanarySafetyGuard(supabase);
  if (!guard.healthy) {
    throw new Error(`Cannot transition canary: Safety guard blocked (${guard.reasons.join('; ')}).`);
  }
  return enableCanary(supabase, adminId, { stage: 'percentage', percentage });
}

async function transitionToPublic(supabase, adminId) {
  const guard = await evaluateCanarySafetyGuard(supabase);
  if (!guard.healthy) {
    throw new Error(`Cannot transition canary: Safety guard blocked (${guard.reasons.join('; ')}).`);
  }
  return enableCanary(supabase, adminId, { stage: 'public', percentage: 100 });
}

/**
 * Advances Canary Rollout to next sequential stage.
 */
async function advanceCanaryStage(supabase, adminId) {
  const guard = await evaluateCanarySafetyGuard(supabase);
  if (!guard.healthy) {
    throw new Error(`Cannot advance canary rollout: Safety guard blocked due to critical issues (${guard.reasons.join('; ')}).`);
  }

  const stageOrder = ['disabled', 'internal', 'limited', 'percentage', 'public'];
  const currentIndex = stageOrder.indexOf(canaryState.stage);

  if (currentIndex === -1 || currentIndex >= stageOrder.length - 1) {
    throw new Error(`Canary is already at terminal stage '${canaryState.stage}'. Cannot advance further.`);
  }

  const nextStage = stageOrder[currentIndex + 1];
  const prev = { ...canaryState };
  canaryState.stage = nextStage;
  canaryState.enabled = true;

  await recordFinancialAudit(supabase, {
    actor_id: adminId,
    actor_role: 'admin',
    action: 'canary_stage_advanced',
    entity_type: 'canary',
    previous_state: prev,
    new_state: canaryState,
    metadata: { advanced_from: prev.stage, advanced_to: nextStage }
  });

  return getCanaryState();
}

module.exports = {
  getCanaryState,
  evaluateCanaryEligibility,
  evaluateCanarySafetyGuard,
  getCanaryMetrics,
  enableCanary,
  pauseCanary,
  resumeCanary,
  transitionToInternal,
  transitionToLimited,
  transitionToPercentage,
  transitionToPublic,
  advanceCanaryStage
};
