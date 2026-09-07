-- ==============================================================================
-- ONECOOLIE / RAILMITRA — PAYMENT SYSTEM PHASE 10 MIGRATION
-- Real Production Deployment, Launch Certifications & Audit History
-- ==============================================================================

-- 1. Create production_launch_certifications Table (Append-Only Audit Ledger)
CREATE TABLE IF NOT EXISTS public.production_launch_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_session_id UUID REFERENCES public.production_validation_sessions(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('GO', 'CONDITIONAL_GO', 'NO_GO')),
  gate_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  failed_gates TEXT[] DEFAULT '{}',
  blocking_reasons TEXT[] DEFAULT '{}',
  canary_metrics JSONB DEFAULT '{}'::jsonb,
  environment_status JSONB DEFAULT '{}'::jsonb,
  evaluated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for Certification Queries
CREATE INDEX IF NOT EXISTS idx_launch_certifications_decision ON public.production_launch_certifications(decision);
CREATE INDEX IF NOT EXISTS idx_launch_certifications_session_id ON public.production_launch_certifications(validation_session_id);
CREATE INDEX IF NOT EXISTS idx_launch_certifications_created_at ON public.production_launch_certifications(created_at DESC);

-- 3. Strict Append-Only Enforcement for Certification Ledger
CREATE OR REPLACE FUNCTION public.prevent_certification_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'production_launch_certifications is an append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_certification_mutation ON public.production_launch_certifications;
CREATE TRIGGER trg_prevent_certification_mutation
BEFORE UPDATE OR DELETE ON public.production_launch_certifications
FOR EACH ROW
EXECUTE FUNCTION public.prevent_certification_mutation();

-- 4. Row Level Security (RLS) Configuration
ALTER TABLE public.production_launch_certifications ENABLE ROW LEVEL SECURITY;

-- Admins can SELECT and INSERT certifications
DROP POLICY IF EXISTS "Admins can view launch certifications" ON public.production_launch_certifications;
CREATE POLICY "Admins can view launch certifications" ON public.production_launch_certifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert launch certifications" ON public.production_launch_certifications;
CREATE POLICY "Admins can insert launch certifications" ON public.production_launch_certifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role access
DROP POLICY IF EXISTS "Service role can view launch certifications" ON public.production_launch_certifications;
CREATE POLICY "Service role can view launch certifications" ON public.production_launch_certifications
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can insert launch certifications" ON public.production_launch_certifications;
CREATE POLICY "Service role can insert launch certifications" ON public.production_launch_certifications
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
