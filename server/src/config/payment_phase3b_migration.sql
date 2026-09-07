-- ============================================================
-- ONECOOLIE — PAYMENT SYSTEM PHASE 3B DATABASE MIGRATION
-- Assistant Wallet, Settlement & Payout Ledger
-- ============================================================

-- 1. ASSISTANT PAYOUTS TABLE (Authoritative payout ledger)
CREATE TABLE IF NOT EXISTS public.assistant_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (
        status IN (
            'requested',
            'approved',
            'processing',
            'paid',
            'rejected',
            'cancelled',
            'failed'
        )
    ) DEFAULT 'requested',
    payout_method TEXT,
    payout_reference TEXT,
    gateway_payout_id TEXT,
    failure_reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for assistant_payouts
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_assistant_id ON public.assistant_payouts(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_status ON public.assistant_payouts(status);
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_created_at ON public.assistant_payouts(created_at DESC);

-- Enable RLS for assistant_payouts
ALTER TABLE public.assistant_payouts ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Allow all operations for service role on assistant_payouts" ON public.assistant_payouts
    FOR ALL USING (true) WITH CHECK (true);

-- Assistants can view their own payouts
CREATE POLICY "Assistants can view own payouts" ON public.assistant_payouts
    FOR SELECT USING (auth.uid() = assistant_id);

-- Admins can view all payouts
CREATE POLICY "Admins can view all payouts" ON public.assistant_payouts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- 2. ASSISTANT PAYOUT ITEMS TABLE (Explicit 1:1 mapping between payouts and earnings)
CREATE TABLE IF NOT EXISTS public.assistant_payout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES public.assistant_payouts(id) ON DELETE CASCADE,
    earning_id UUID NOT NULL REFERENCES public.assistant_earnings(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_assistant_payout_items_earning UNIQUE (earning_id)
);

-- Indexes for assistant_payout_items
CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id ON public.assistant_payout_items(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_earning_id ON public.assistant_payout_items(earning_id);

-- Enable RLS for assistant_payout_items
ALTER TABLE public.assistant_payout_items ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Allow all operations for service role on assistant_payout_items" ON public.assistant_payout_items
    FOR ALL USING (true) WITH CHECK (true);

-- Assistants can view their own payout items
CREATE POLICY "Assistants can view own payout items" ON public.assistant_payout_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assistant_payouts
            WHERE assistant_payouts.id = assistant_payout_items.payout_id
            AND assistant_payouts.assistant_id = auth.uid()
        )
    );

-- Admins can view all payout items
CREATE POLICY "Admins can view all payout items" ON public.assistant_payout_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );
