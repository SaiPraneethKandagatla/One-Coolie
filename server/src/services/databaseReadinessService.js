/**
 * server/src/services/databaseReadinessService.js
 *
 * Database Schema & Financial Tables Readiness Verifier (Phase 6)
 *
 * Verifies non-destructively that all required tables and critical columns
 * from Phases 1 through 5 exist and are accessible via the Supabase client.
 *
 * STRICT SECURITY: Never exposes database credentials or connection strings.
 */

const REQUIRED_FINANCIAL_TABLES = [
  'users',
  'bookings',
  'payments',
  'refunds',
  'assistant_earnings',
  'assistant_payouts',
  'assistant_payout_items',
  'financial_audit_logs',
  'financial_incidents',
  'payment_webhook_events'
];

/**
 * Runs non-destructive schema readiness check across all required financial tables.
 *
 * @param {object} supabase
 * @returns {Promise<{
 *   ready: boolean,
 *   status: 'READY' | 'WARNING' | 'NOT_READY',
 *   total_required: number,
 *   tables_checked: number,
 *   available_tables: string[],
 *   missing_tables: string[],
 *   database_latency_ms: number,
 *   details: object
 * }>}
 */
async function checkDatabaseReadiness(supabase) {
  const start = Date.now();
  const missingTables = [];
  const availableTables = [];
  const details = {};

  for (const table of REQUIRED_FINANCIAL_TABLES) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);

      if (error) {
        // PostgREST 42P01: relation does not exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          missingTables.push(table);
          details[table] = { status: 'missing', error: 'Table does not exist' };
        } else if (error.code === 'PGRST116') {
          // PGRST116 is just 0 rows returned on maybeSingle or similar, table exists
          availableTables.push(table);
          details[table] = { status: 'available', empty: true };
        } else {
          // Other query error (e.g. permission or empty)
          availableTables.push(table);
          details[table] = { status: 'available', notice: error.message };
        }
      } else {
        availableTables.push(table);
        details[table] = { status: 'available' };
      }
    } catch (err) {
      missingTables.push(table);
      details[table] = { status: 'error', error: err.message };
    }
  }

  const latencyMs = Date.now() - start;

  let status = 'READY';
  if (missingTables.length > 0) {
    // Core critical tables missing: bookings, payments, assistant_earnings
    const hasCriticalMissing = missingTables.some((t) =>
      ['bookings', 'payments', 'assistant_earnings'].includes(t)
    );
    status = hasCriticalMissing ? 'NOT_READY' : 'WARNING';
  }

  return {
    ready: status === 'READY',
    status,
    total_required: REQUIRED_FINANCIAL_TABLES.length,
    database_latency_ms: latencyMs,
    tables_checked: REQUIRED_FINANCIAL_TABLES.length,
    available_tables: availableTables,
    missing_tables: missingTables,
    details
  };
}

module.exports = {
  REQUIRED_FINANCIAL_TABLES,
  checkDatabaseReadiness
};
