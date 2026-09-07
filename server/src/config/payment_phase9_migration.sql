-- ==============================================================================
-- ONECOOLIE / RAILMITRA — PAYMENT SYSTEM PHASE 9 MIGRATION
-- Live Production Validation, Validation Evidence Ledger & Canary Operations
-- ==============================================================================

-- 1. Create production_validation_sessions Table
CREATE TABLE IF NOT EXISTS public.production_validation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'blocked', 'completed', 'failed')),
  started_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  code_version TEXT,
  deployment_identifier TEXT,

  backend_url TEXT,
  frontend_url TEXT,

  gateway_mode TEXT DEFAULT 'test',

  health_verified BOOLEAN DEFAULT FALSE,
  readiness_verified BOOLEAN DEFAULT FALSE,
  database_verified BOOLEAN DEFAULT FALSE,

  razorpay_configuration_verified BOOLEAN DEFAULT FALSE,
  webhook_configuration_verified BOOLEAN DEFAULT FALSE,

  live_payment_verified BOOLEAN DEFAULT FALSE,
  webhook_delivery_verified BOOLEAN DEFAULT FALSE,
  payment_recovery_verified BOOLEAN DEFAULT FALSE,

  refund_verified BOOLEAN DEFAULT FALSE,
  earning_reversal_verified BOOLEAN DEFAULT FALSE,
  wallet_verified BOOLEAN DEFAULT FALSE,
  manual_settlement_verified BOOLEAN DEFAULT FALSE,

  reconciliation_verified BOOLEAN DEFAULT FALSE,
  incident_monitoring_verified BOOLEAN DEFAULT FALSE,

  canary_verified BOOLEAN DEFAULT FALSE,

  final_decision TEXT CHECK (final_decision IN ('GO', 'CONDITIONAL_GO', 'NO_GO')),

  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create production_validation_evidence Table (Append-Only Evidence Ledger)
CREATE TABLE IF NOT EXISTS public.production_validation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.production_validation_sessions(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL,

  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role TEXT,

  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
  payout_id UUID REFERENCES public.assistant_payouts(id) ON DELETE SET NULL,

  amount NUMERIC,
  currency TEXT DEFAULT 'INR',

  reference_type TEXT,
  reference_value TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for Session & Evidence Queries
CREATE INDEX IF NOT EXISTS idx_validation_sessions_status ON public.production_validation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_validation_sessions_started_at ON public.production_validation_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_session_id ON public.production_validation_evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_step ON public.production_validation_evidence(step);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_created_at ON public.production_validation_evidence(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_payment ON public.production_validation_evidence(payment_id);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_booking ON public.production_validation_evidence(booking_id);

-- 4. Strict Append-Only Enforcement for Evidence Ledger
-- Prevent UPDATE or DELETE on evidence ledger via PostgreSQL Trigger
CREATE OR REPLACE FUNCTION public.prevent_evidence_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'production_validation_evidence is an append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_evidence_mutation ON public.production_validation_evidence;
CREATE TRIGGER trg_prevent_evidence_mutation
BEFORE UPDATE OR DELETE ON public.production_validation_evidence
FOR EACH ROW
EXECUTE FUNCTION public.prevent_evidence_ledger_mutation();

-- 5. Row Level Security (RLS) Configuration
ALTER TABLE public.production_validation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_validation_evidence ENABLE ROW LEVEL SECURITY;

-- Admins full access to sessions
DROP POLICY IF EXISTS "Admins have full access to validation sessions" ON public.production_validation_sessions;
CREATE POLICY "Admins have full access to validation sessions" ON public.production_validation_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role access to sessions
DROP POLICY IF EXISTS "Service role access to validation sessions" ON public.production_validation_sessions;
CREATE POLICY "Service role access to validation sessions" ON public.production_validation_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Admins can SELECT and INSERT evidence (no UPDATE/DELETE permitted)
DROP POLICY IF EXISTS "Admins can view validation evidence" ON public.production_validation_evidence;
CREATE POLICY "Admins can view validation evidence" ON public.production_validation_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert validation evidence" ON public.production_validation_evidence;
CREATE POLICY "Admins can insert validation evidence" ON public.production_validation_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role access to evidence (SELECT and INSERT only)
DROP POLICY IF EXISTS "Service role can view validation evidence" ON public.production_validation_evidence;
CREATE POLICY "Service role can view validation evidence" ON public.production_validation_evidence
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can insert validation evidence" ON public.production_validation_evidence;
CREATE POLICY "Service role can insert validation evidence" ON public.production_validation_evidence
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
