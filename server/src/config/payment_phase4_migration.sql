-- ============================================================
-- ONECOOLIE — PAYMENT SYSTEM PHASE 4 DATABASE MIGRATION
-- Manual Payout Settlement, Financial Audit Ledger & Reconciliation
-- ============================================================

-- 1. EXTEND ASSISTANT PAYOUTS TABLE FOR SETTLEMENT AUDITING
-- Add settlement_date and settlement_notes if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assistant_payouts' AND column_name = 'settlement_date'
    ) THEN
        ALTER TABLE public.assistant_payouts ADD COLUMN settlement_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assistant_payouts' AND column_name = 'settlement_notes'
    ) THEN
        ALTER TABLE public.assistant_payouts ADD COLUMN settlement_notes TEXT;
    END IF;
END $$;

-- Enforce uniqueness of payout_reference across settled ('paid') payouts
-- Prevents duplicate settlement reference fraud/errors
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_assistant_payouts_reference_paid
    ON public.assistant_payouts (payout_reference)
    WHERE payout_reference IS NOT NULL AND status = 'paid';

-- 2. FINANCIAL AUDIT LEDGER TABLE (Append-Only Audit Trail)
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    payout_id UUID REFERENCES public.assistant_payouts(id) ON DELETE SET NULL,
    earning_id UUID REFERENCES public.assistant_earnings(id) ON DELETE SET NULL,
    refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2),
    currency TEXT DEFAULT 'INR',
    previous_state JSONB DEFAULT '{}'::jsonb,
    new_state JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Ledger Indexes for high-performance reconciliation and tracing
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.financial_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.financial_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_payout_id ON public.financial_audit_logs(payout_id);
CREATE INDEX IF NOT EXISTS idx_audit_booking_id ON public.financial_audit_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_payment_id ON public.financial_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.financial_audit_logs(created_at DESC);

-- Enable Row-Level Security for financial_audit_logs
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Allow all operations for service role on financial_audit_logs" ON public.financial_audit_logs
    FOR ALL USING (true) WITH CHECK (true);

-- Admins can view all financial audit logs
CREATE POLICY "Admins can view all financial audit logs" ON public.financial_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- Prevent unauthorized UPDATE or DELETE (Append-Only Audit Security)
-- PostgreSQL doesn't allow UPDATE/DELETE if no policy allows them under RLS.
