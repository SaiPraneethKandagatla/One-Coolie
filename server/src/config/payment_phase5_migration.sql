-- ==============================================================================
-- ONECOOLIE / RAILMITRA — PAYMENT SYSTEM PHASE 5 MIGRATION
-- Production Hardening, Fraud Protection, Monitoring, Alerting & Incident Ops
-- ==============================================================================

-- 1. Create financial_incidents Table
CREATE TABLE IF NOT EXISTS public.financial_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
  title TEXT NOT NULL,
  description TEXT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
  payout_id UUID REFERENCES public.assistant_payouts(id) ON DELETE SET NULL,
  assistant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  passenger_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance & Filtering Indexes
CREATE INDEX IF NOT EXISTS idx_financial_incidents_status ON public.financial_incidents(status);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_severity ON public.financial_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_type ON public.financial_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_booking ON public.financial_incidents(booking_id);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_payment ON public.financial_incidents(payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_payout ON public.financial_incidents(payout_id);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_created_at ON public.financial_incidents(created_at DESC);

-- Partial index for fast deduplication of active unresolved incidents
CREATE INDEX IF NOT EXISTS idx_financial_incidents_active_dedup 
ON public.financial_incidents(incident_type, COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::uuid), status) 
WHERE status IN ('open', 'investigating');

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.financial_incidents ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all financial incidents
DROP POLICY IF EXISTS "Admins have full access to financial incidents" ON public.financial_incidents;
CREATE POLICY "Admins have full access to financial incidents" ON public.financial_incidents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role has full access
DROP POLICY IF EXISTS "Service role has full access to financial incidents" ON public.financial_incidents;
CREATE POLICY "Service role has full access to financial incidents" ON public.financial_incidents
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
