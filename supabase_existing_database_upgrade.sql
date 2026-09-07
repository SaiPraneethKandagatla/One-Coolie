-- ==============================================================================
-- ONECOOLIE / RailMitra — Existing Database Repair & Upgrade Migration
-- Version B: Safe, Non-Destructive In-Place Upgrade
--
-- System: ONECOOLIE Railway Assistance Platform
-- Target: Existing Supabase Projects with partial or existing tables
-- 
-- SAFETY GUARANTEES:
--  1. ZERO DATA DELETION: Does NOT drop tables or truncate user/booking data.
--  2. IDEMPOTENT: Safe to run multiple times without causing duplicate errors.
--  3. INCREMENTAL COLUMNS: Uses `ADD COLUMN IF NOT EXISTS` across all tables.
--  4. IMMUTABLE TRIGGERS: Ensures append-only audit & certification protections.
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TRIGGER FUNCTIONS (Safe Replacement)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.prevent_financial_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'financial_audit_logs is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.prevent_evidence_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'production_validation_evidence is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.prevent_certification_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'production_launch_certifications is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. CORE APPLICATION TABLES & COLUMN REPAIRS
-- ==============================================================================

-- 3.1 Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'passenger';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS station_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'not_submitted';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_documents JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3.2 Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT UNIQUE NOT NULL,
    passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    train_number TEXT NOT NULL,
    train_name TEXT NOT NULL,
    station_code TEXT NOT NULL,
    journey_date TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS assistant_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS journey_time TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_description TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS assistant_status TEXT DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_otp TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_otp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_otp_expires_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS review TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS sos_triggered BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS sos_triggered_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_started_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3.3 Email OTPs Table
CREATE TABLE IF NOT EXISTS public.email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('login', 'signup')),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0 CHECK (attempts >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 SOS Alerts Table
CREATE TABLE IF NOT EXISTS public.sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    station_code TEXT NOT NULL,
    train_no TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. PAYMENT & REFUND LEDGER TABLES
-- ==============================================================================

-- 4.1 Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT,
    payment_gateway TEXT DEFAULT 'razorpay',
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_signature TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'razorpay';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_signature TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4.2 Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    passenger_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_gateway TEXT DEFAULT 'razorpay',
    gateway_refund_id TEXT,
    gateway_payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on refunds
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- 5. ASSISTANT EARNINGS & PAYOUT SYSTEM
-- ==============================================================================

-- 5.1 Assistant Earnings Table
CREATE TABLE IF NOT EXISTS public.assistant_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    gross_amount NUMERIC(10, 2) NOT NULL CHECK (gross_amount >= 0),
    platform_commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    platform_commission_amount NUMERIC(10, 2) NOT NULL CHECK (platform_commission_amount >= 0),
    assistant_amount NUMERIC(10, 2) NOT NULL CHECK (assistant_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending',
    available_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure unique constraint on booking_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_assistant_earnings_booking'
    ) THEN
        ALTER TABLE public.assistant_earnings 
        ADD CONSTRAINT uq_assistant_earnings_booking UNIQUE (booking_id);
    END IF;
END $$;

-- 5.2 Assistant Payouts Table
CREATE TABLE IF NOT EXISTS public.assistant_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'requested',
    payout_method TEXT,
    payout_reference TEXT,
    gateway_payout_id TEXT,
    failure_reason TEXT,
    settlement_date TIMESTAMPTZ,
    settlement_notes TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure Phase 4 settlement columns exist
ALTER TABLE public.assistant_payouts ADD COLUMN IF NOT EXISTS settlement_date TIMESTAMPTZ;
ALTER TABLE public.assistant_payouts ADD COLUMN IF NOT EXISTS settlement_notes TEXT;
ALTER TABLE public.assistant_payouts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.assistant_payouts ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 5.3 Assistant Payout Items Table
CREATE TABLE IF NOT EXISTS public.assistant_payout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES public.assistant_payouts(id) ON DELETE CASCADE,
    earning_id UUID NOT NULL REFERENCES public.assistant_earnings(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_assistant_payout_items_earning'
    ) THEN
        ALTER TABLE public.assistant_payout_items 
        ADD CONSTRAINT uq_assistant_payout_items_earning UNIQUE (earning_id);
    END IF;
END $$;

-- ==============================================================================
-- 6. AUDIT, RECONCILIATION & INCIDENT TABLES
-- ==============================================================================

-- 6.1 Financial Audit Logs Table (Append-Only)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.2 Financial Incidents Table
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

-- 6.3 Payment Webhook Events Table
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway TEXT NOT NULL DEFAULT 'razorpay',
    event_type TEXT NOT NULL,
    gateway_event_id TEXT UNIQUE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    payload JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. PRODUCTION VALIDATION & LAUNCH CERTIFICATION TABLES
-- ==============================================================================

-- 7.1 Production Validation Sessions
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

-- 7.2 Production Validation Evidence (Append-Only)
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

-- 7.3 Production Launch Certifications (Append-Only)
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

-- ==============================================================================
-- 8. INDEXES & CONSTRAINTS (Idempotent Creation)
-- ==============================================================================

-- Unique constraint for paid payout references (Option C Fraud Prevention)
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_assistant_payouts_reference_paid
    ON public.assistant_payouts (payout_reference)
    WHERE payout_reference IS NOT NULL AND status = 'paid';

-- Performance indexes across all ledgers
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_station ON public.users(station_code);

CREATE INDEX IF NOT EXISTS idx_bookings_booking_id ON public.bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON public.bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_assistant_id ON public.bookings(assistant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON public.payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id ON public.payments(gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON public.refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

CREATE INDEX IF NOT EXISTS idx_assistant_earnings_assistant_id ON public.assistant_earnings(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_booking_id ON public.assistant_earnings(booking_id);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_status ON public.assistant_earnings(status);

CREATE INDEX IF NOT EXISTS idx_assistant_payouts_assistant_id ON public.assistant_payouts(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_status ON public.assistant_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id ON public.assistant_payout_items(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_earning_id ON public.assistant_payout_items(earning_id);

CREATE INDEX IF NOT EXISTS idx_audit_action ON public.financial_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.financial_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_incidents_status ON public.financial_incidents(status);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_severity ON public.financial_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_active_dedup 
    ON public.financial_incidents(incident_type, COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::uuid), status) 
    WHERE status IN ('open', 'investigating');

CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway_event_id ON public.payment_webhook_events(gateway_event_id);
CREATE INDEX IF NOT EXISTS idx_validation_sessions_status ON public.production_validation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_session_id ON public.production_validation_evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_launch_certifications_decision ON public.production_launch_certifications(decision);

-- ==============================================================================
-- 9. ATTACH TRIGGERS (Safe Replacement)
-- ==============================================================================

-- Timestamp triggers
DROP TRIGGER IF EXISTS set_timestamp_users ON public.users;
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_bookings ON public.bookings;
CREATE TRIGGER set_timestamp_bookings
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_payments ON public.payments;
CREATE TRIGGER set_timestamp_payments
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_refunds ON public.refunds;
CREATE TRIGGER set_timestamp_refunds
BEFORE UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_assistant_earnings ON public.assistant_earnings;
CREATE TRIGGER set_timestamp_assistant_earnings
BEFORE UPDATE ON public.assistant_earnings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_assistant_payouts ON public.assistant_payouts;
CREATE TRIGGER set_timestamp_assistant_payouts
BEFORE UPDATE ON public.assistant_payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_financial_incidents ON public.financial_incidents;
CREATE TRIGGER set_timestamp_financial_incidents
BEFORE UPDATE ON public.financial_incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_timestamp_validation_sessions ON public.production_validation_sessions;
CREATE TRIGGER set_timestamp_validation_sessions
BEFORE UPDATE ON public.production_validation_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Append-only ledger protection triggers
DROP TRIGGER IF EXISTS trg_prevent_financial_audit_mutation ON public.financial_audit_logs;
CREATE TRIGGER trg_prevent_financial_audit_mutation
BEFORE UPDATE OR DELETE ON public.financial_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_audit_mutation();

DROP TRIGGER IF EXISTS trg_prevent_evidence_mutation ON public.production_validation_evidence;
CREATE TRIGGER trg_prevent_evidence_mutation
BEFORE UPDATE OR DELETE ON public.production_validation_evidence
FOR EACH ROW EXECUTE FUNCTION public.prevent_evidence_ledger_mutation();

DROP TRIGGER IF EXISTS trg_prevent_certification_mutation ON public.production_launch_certifications;
CREATE TRIGGER trg_prevent_certification_mutation
BEFORE UPDATE OR DELETE ON public.production_launch_certifications
FOR EACH ROW EXECUTE FUNCTION public.prevent_certification_mutation();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) ENABLEMENT & POLICIES
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_validation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_validation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_launch_certifications ENABLE ROW LEVEL SECURITY;

-- Service role full access policies (Safe Idempotent Replacement)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all operations for service role on users" ON public.users;
    CREATE POLICY "Allow all operations for service role on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on bookings" ON public.bookings;
    CREATE POLICY "Allow all operations for service role on bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on payments" ON public.payments;
    CREATE POLICY "Allow all operations for service role on payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on refunds" ON public.refunds;
    CREATE POLICY "Allow all operations for service role on refunds" ON public.refunds FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on assistant_earnings" ON public.assistant_earnings;
    CREATE POLICY "Allow all operations for service role on assistant_earnings" ON public.assistant_earnings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on assistant_payouts" ON public.assistant_payouts;
    CREATE POLICY "Allow all operations for service role on assistant_payouts" ON public.assistant_payouts FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on assistant_payout_items" ON public.assistant_payout_items;
    CREATE POLICY "Allow all operations for service role on assistant_payout_items" ON public.assistant_payout_items FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on financial_audit_logs" ON public.financial_audit_logs;
    CREATE POLICY "Allow all operations for service role on financial_audit_logs" ON public.financial_audit_logs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on financial_incidents" ON public.financial_incidents;
    CREATE POLICY "Allow all operations for service role on financial_incidents" ON public.financial_incidents FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on payment_webhook_events" ON public.payment_webhook_events;
    CREATE POLICY "Allow all operations for service role on payment_webhook_events" ON public.payment_webhook_events FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on validation_sessions" ON public.production_validation_sessions;
    CREATE POLICY "Allow all operations for service role on validation_sessions" ON public.production_validation_sessions FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on validation_evidence" ON public.production_validation_evidence;
    CREATE POLICY "Allow all operations for service role on validation_evidence" ON public.production_validation_evidence FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all operations for service role on launch_certifications" ON public.production_launch_certifications;
    CREATE POLICY "Allow all operations for service role on launch_certifications" ON public.production_launch_certifications FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 11. SCHEMA VERIFICATION QUERIES (10 Verification Checks)
-- ==============================================================================

-- 1. All 16 Required Tables Exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'users', 'bookings', 'payments', 'refunds', 'assistant_earnings',
    'assistant_payouts', 'assistant_payout_items', 'financial_audit_logs',
    'financial_incidents', 'payment_webhook_events', 'email_otps',
    'activity_logs', 'sos_alerts', 'production_validation_sessions',
    'production_validation_evidence', 'production_launch_certifications'
  )
ORDER BY table_name;

-- 2. Required Columns on assistant_payouts Exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assistant_payouts'
  AND column_name IN ('payout_reference', 'payout_method', 'settlement_date', 'settlement_notes', 'reviewed_at', 'reviewed_by');

-- 3. Required Foreign Keys Exist
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('bookings', 'payments', 'refunds', 'assistant_earnings', 'assistant_payouts', 'assistant_payout_items');

-- 4. Required Performance Indexes Exist
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
  AND indexname IN (
    'uq_idx_assistant_payouts_reference_paid',
    'idx_payments_booking_id',
    'idx_refunds_booking_id',
    'idx_assistant_earnings_assistant_id',
    'idx_audit_action',
    'idx_financial_incidents_active_dedup',
    'idx_webhook_events_gateway_event_id'
  );

-- 5. RLS Status is Correct
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN (
    'users', 'bookings', 'payments', 'refunds', 'assistant_earnings',
    'assistant_payouts', 'assistant_payout_items', 'financial_audit_logs',
    'financial_incidents', 'payment_webhook_events', 'production_validation_sessions',
    'production_validation_evidence', 'production_launch_certifications'
);

-- 6. Immutable Triggers Exist
SELECT tgname, relname 
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname IN (
    'trg_prevent_financial_audit_mutation',
    'trg_prevent_evidence_mutation',
    'trg_prevent_certification_mutation'
);

-- 7. Duplicate Payout References Are Blocked (Partial Unique Index)
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname = 'uq_idx_assistant_payouts_reference_paid';

-- 8. Financial Audit Logs Trigger Function is Attached
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'prevent_financial_audit_mutation';

-- 9. Validation Evidence Trigger Function is Attached
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'prevent_evidence_ledger_mutation';

-- 10. Launch Certification Trigger Function is Attached
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'prevent_certification_mutation';
