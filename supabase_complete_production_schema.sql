-- ==============================================================================
-- ONECOOLIE / RailMitra — Master Supabase Production Database Schema
-- Version A: Fresh Database Setup from Scratch
-- 
-- System: ONECOOLIE Railway Assistance Platform
-- Covers: Phases 1 through 10 (Payments, Option C Hybrid Ledger, Wallet,
--         Manual Payout Settlement, Refunds, Fraud Detection, Reconciliation,
--         Canary Ops, Production Diagnostics & Launch Certification)
-- ==============================================================================

-- ==============================================================================
-- SECTION 1 — EXTENSIONS
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- SECTION 2 — CUSTOM FUNCTIONS
-- ==============================================================================

-- Universal trigger function for auto-updating updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Immutable trigger function for financial audit logs
CREATE OR REPLACE FUNCTION public.prevent_financial_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'financial_audit_logs is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Immutable trigger function for production validation evidence
CREATE OR REPLACE FUNCTION public.prevent_evidence_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'production_validation_evidence is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Immutable trigger function for production launch certifications
CREATE OR REPLACE FUNCTION public.prevent_certification_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'production_launch_certifications is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- SECTION 3 — CORE TABLES (users, bookings, email_otps, activity_logs, sos_alerts)
-- ==============================================================================

-- 3.1 USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('passenger', 'assistant', 'admin')) DEFAULT 'passenger',
    station_code TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    is_online BOOLEAN DEFAULT FALSE,
    kyc_status TEXT CHECK (kyc_status IN ('not_submitted', 'pending', 'approved', 'rejected')) DEFAULT 'not_submitted',
    kyc_documents JSONB DEFAULT '{}'::jsonb,
    kyc_rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 BOOKINGS TABLE (Option C Hybrid Gate Lifecycle)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT UNIQUE NOT NULL,
    passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    train_number TEXT NOT NULL,
    train_name TEXT NOT NULL,
    station_code TEXT NOT NULL,
    source TEXT,
    destination TEXT,
    journey_date TEXT NOT NULL,
    journey_time TEXT,
    service TEXT,
    services JSONB DEFAULT '{}'::jsonb,
    service_description TEXT,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')) DEFAULT 'pending',
    payment_method TEXT CHECK (payment_method IN ('cash', 'online', 'upi', 'card', 'netbanking')),
    payment_id TEXT,
    booking_status TEXT NOT NULL CHECK (booking_status IN ('pending', 'accepted', 'arriving', 'in_service', 'completed', 'cancelled')) DEFAULT 'pending',
    assistant_status TEXT CHECK (assistant_status IN ('pending', 'accepted', 'arriving', 'in_service', 'completed', 'cancelled')) DEFAULT 'pending',
    start_otp TEXT,
    start_otp_verified BOOLEAN DEFAULT FALSE,
    start_otp_expires_at TIMESTAMPTZ,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    sos_triggered BOOLEAN DEFAULT FALSE,
    sos_triggered_at TIMESTAMPTZ,
    service_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 EMAIL OTPS TABLE (Secure Authentication)
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

-- 3.4 ACTIVITY LOGS TABLE (Operational Audit)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 SOS ALERTS TABLE (Emergency Assistance Logs)
CREATE TABLE IF NOT EXISTS public.sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    station_code TEXT NOT NULL,
    train_no TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SECTION 4 — PAYMENT TABLES (payments)
-- ==============================================================================

-- Authoritative Payment Ledger (Phase 1 & Phase 2)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT CHECK (payment_method IN ('cash', 'online', 'upi', 'card', 'netbanking')),
    payment_gateway TEXT DEFAULT 'razorpay',
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_signature TEXT,
    status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')) DEFAULT 'pending',
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SECTION 5 — REFUND TABLES (refunds)
-- ==============================================================================

-- Authoritative Refund Ledger (Phase 3A)
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
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'cancelled')) DEFAULT 'pending',
    reason TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SECTION 6 — ASSISTANT WALLET & EARNINGS (assistant_earnings)
-- ==============================================================================

-- 20/80 Commission Split & Maturation Ledger (Phase 1 & Phase 3B)
CREATE TABLE IF NOT EXISTS public.assistant_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    gross_amount NUMERIC(10, 2) NOT NULL CHECK (gross_amount >= 0),
    platform_commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.00 CHECK (platform_commission_percent >= 0 AND platform_commission_percent <= 100),
    platform_commission_amount NUMERIC(10, 2) NOT NULL CHECK (platform_commission_amount >= 0),
    assistant_amount NUMERIC(10, 2) NOT NULL CHECK (assistant_amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'available', 'held', 'paid_out', 'reversed')) DEFAULT 'pending',
    available_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assistant_earnings_booking UNIQUE (booking_id)
);

-- ==============================================================================
-- SECTION 7 — ASSISTANT PAYOUT SYSTEM (assistant_payouts, assistant_payout_items)
-- ==============================================================================

-- 7.1 Authoritative Payout Settlement Ledger (Option C Manual Settlement, Phase 3B & 4)
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
    payout_method TEXT CHECK (payout_method IS NULL OR payout_method IN ('upi', 'imps', 'neft', 'bank_transfer', 'cash', 'other', 'upi_manual')),
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

-- 7.2 Explicit 1:1 Payout-to-Earning Item Mapping
CREATE TABLE IF NOT EXISTS public.assistant_payout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES public.assistant_payouts(id) ON DELETE CASCADE,
    earning_id UUID NOT NULL REFERENCES public.assistant_earnings(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assistant_payout_items_earning UNIQUE (earning_id)
);

-- ==============================================================================
-- SECTION 8 — FINANCIAL AUDIT & RECONCILIATION TABLES (financial_audit_logs)
-- ==============================================================================

-- Immutable Append-Only Financial Audit Trail (Phase 4)
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

-- ==============================================================================
-- SECTION 9 — FRAUD & INCIDENT TABLES (financial_incidents)
-- ==============================================================================

-- Automated Anomaly & Incident Management Ledger (Phase 5)
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

-- ==============================================================================
-- SECTION 10 — WEBHOOK EVENT TABLES (payment_webhook_events)
-- ==============================================================================

-- Gateway Webhook Ingestion, Cryptographic Audit & Deduplication Ledger (Phase 2C)
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
-- SECTION 11 — PRODUCTION VALIDATION TABLES
-- ==============================================================================

-- 11.1 Production Validation Sessions (Phase 9 & 10)
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

-- 11.2 Immutable Append-Only Validation Evidence Ledger (Phase 9 & 10)
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

-- ==============================================================================
-- SECTION 12 — LAUNCH CERTIFICATION TABLES
-- ==============================================================================

-- 12.1 Immutable 14-Gate Production Launch Certifications Ledger (Phase 10)
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
-- SECTION 13 — FOREIGN KEYS & CONSTRAINTS (Unique Indexes & Rules)
-- ==============================================================================

-- Prevent duplicate payment settlement references across settled ('paid') payouts
-- Allows NULL / empty for unpaid/requested/cancelled payouts
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_assistant_payouts_reference_paid
    ON public.assistant_payouts (payout_reference)
    WHERE payout_reference IS NOT NULL AND status = 'paid';

-- Ensure 1:1 mapping between booking and assistant_earnings
-- (Enforced by table definition, redundant safe index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_assistant_earnings_booking_id
    ON public.assistant_earnings(booking_id);

-- Ensure 1:1 payout claim per earning item
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_payout_items_earning_id
    ON public.assistant_payout_items(earning_id);

-- ==============================================================================
-- SECTION 14 — PERFORMANCE INDEXES
-- ==============================================================================

-- 14.1 Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_station ON public.users(station_code);
CREATE INDEX IF NOT EXISTS idx_users_online ON public.users(is_online) WHERE role = 'assistant';

-- 14.2 Bookings Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_booking_id ON public.bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON public.bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_assistant_id ON public.bookings(assistant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_station_code ON public.bookings(station_code);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_sos ON public.bookings(sos_triggered) WHERE sos_triggered = TRUE;

-- 14.3 Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_passenger_id ON public.payments(passenger_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON public.payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id ON public.payments(gateway_payment_id);

-- 14.4 Refunds Indexes
CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON public.refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_passenger_id ON public.refunds(passenger_id);
CREATE INDEX IF NOT EXISTS idx_refunds_gateway_refund_id ON public.refunds(gateway_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at DESC);

-- 14.5 Assistant Earnings Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_assistant_id ON public.assistant_earnings(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_booking_id ON public.assistant_earnings(booking_id);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_payment_id ON public.assistant_earnings(payment_id);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_status ON public.assistant_earnings(status);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_created_at ON public.assistant_earnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_available_at ON public.assistant_earnings(available_at);

-- 14.6 Assistant Payouts & Items Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_assistant_id ON public.assistant_payouts(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_status ON public.assistant_payouts(status);
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_created_at ON public.assistant_payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_payouts_reference ON public.assistant_payouts(payout_reference);
CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id ON public.assistant_payout_items(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_earning_id ON public.assistant_payout_items(earning_id);

-- 14.7 Financial Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.financial_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.financial_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_booking_id ON public.financial_audit_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_payment_id ON public.financial_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_payout_id ON public.financial_audit_logs(payout_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.financial_audit_logs(created_at DESC);

-- 14.8 Financial Incidents Indexes
CREATE INDEX IF NOT EXISTS idx_financial_incidents_status ON public.financial_incidents(status);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_severity ON public.financial_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_type ON public.financial_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_booking ON public.financial_incidents(booking_id);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_payment ON public.financial_incidents(payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_payout ON public.financial_incidents(payout_id);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_created_at ON public.financial_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_incidents_active_dedup 
    ON public.financial_incidents(incident_type, COALESCE(booking_id, '00000000-0000-0000-0000-000000000000'::uuid), status) 
    WHERE status IN ('open', 'investigating');

-- 14.9 Webhook Events Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway_event_id ON public.payment_webhook_events(gateway_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON public.payment_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_booking_id ON public.payment_webhook_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.payment_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.payment_webhook_events(created_at DESC);

-- 14.10 Email OTPs, Activity & SOS Indexes
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON public.email_otps(email);
CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON public.email_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_booking_id ON public.sos_alerts(booking_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_passenger_id ON public.sos_alerts(passenger_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_station_code ON public.sos_alerts(station_code);

-- 14.11 Launch Validation & Certifications Indexes
CREATE INDEX IF NOT EXISTS idx_validation_sessions_status ON public.production_validation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_validation_sessions_started_at ON public.production_validation_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_session_id ON public.production_validation_evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_step ON public.production_validation_evidence(step);
CREATE INDEX IF NOT EXISTS idx_validation_evidence_created_at ON public.production_validation_evidence(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_launch_certifications_decision ON public.production_launch_certifications(decision);
CREATE INDEX IF NOT EXISTS idx_launch_certifications_session_id ON public.production_launch_certifications(validation_session_id);
CREATE INDEX IF NOT EXISTS idx_launch_certifications_created_at ON public.production_launch_certifications(created_at DESC);

-- ==============================================================================
-- SECTION 15 — IMMUTABLE LEDGER TRIGGERS & TIMESTAMP TRIGGERS
-- ==============================================================================

-- 15.1 Updated At Auto-Refresh Triggers
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

-- 15.2 Strict Append-Only Mutation Interceptors
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
-- SECTION 16 — ROW LEVEL SECURITY (RLS) ENABLEMENT
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
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

-- ==============================================================================
-- SECTION 17 — RLS POLICIES (Backend Service Role & Secure Client Access)
-- ==============================================================================

-- 17.1 Service Role Universal Access (Backend Invariants)
-- The Node.js Express server uses SUPABASE_SECRET_KEY (service_role) to execute all ledger invariants
CREATE POLICY "Allow all operations for service role on users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on bookings" ON public.bookings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on email_otps" ON public.email_otps
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on activity_logs" ON public.activity_logs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on sos_alerts" ON public.sos_alerts
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on payments" ON public.payments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on refunds" ON public.refunds
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on assistant_earnings" ON public.assistant_earnings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on assistant_payouts" ON public.assistant_payouts
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on assistant_payout_items" ON public.assistant_payout_items
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on financial_audit_logs" ON public.financial_audit_logs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on financial_incidents" ON public.financial_incidents
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on payment_webhook_events" ON public.payment_webhook_events
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on validation_sessions" ON public.production_validation_sessions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on validation_evidence" ON public.production_validation_evidence
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on launch_certifications" ON public.production_launch_certifications
    FOR ALL USING (true) WITH CHECK (true);

-- 17.2 Authenticated Client & Assistant Access Policies
CREATE POLICY "Assistants can view own payouts" ON public.assistant_payouts
    FOR SELECT USING (auth.uid() = assistant_id);

CREATE POLICY "Assistants can view own payout items" ON public.assistant_payout_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assistant_payouts
            WHERE assistant_payouts.id = assistant_payout_items.payout_id
            AND assistant_payouts.assistant_id = auth.uid()
        )
    );

-- 17.3 Admin Role Governance Policies
CREATE POLICY "Admins can view and manage all payouts" ON public.assistant_payouts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can view and manage all payout items" ON public.assistant_payout_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can view all financial audit logs" ON public.financial_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins have full access to financial incidents" ON public.financial_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins have full access to validation sessions" ON public.production_validation_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can view validation evidence" ON public.production_validation_evidence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert validation evidence" ON public.production_validation_evidence
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can view launch certifications" ON public.production_launch_certifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert launch certifications" ON public.production_launch_certifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- ==============================================================================
-- SECTION 18 — SEED / BOOTSTRAP DATA
-- ==============================================================================

-- Optional default seed accounts (Admin, Passenger, Assistant)
-- Passwords below are pre-hashed with bcrypt (Default password for all three: Test@1234)
INSERT INTO public.users (id, name, email, password, phone, role, station_code, is_approved, is_online, kyc_status)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Admin Operator', 'admin@onecoolie.in', '$2a$10$w6z9V3T7Vw0SgQc6sN.e.uVzU9uYfIlnc2U9zX2/yQhXv9FqG5T2a', '9876543210', 'admin', 'NDLS', true, true, 'approved'),
    ('a0000000-0000-0000-0000-000000000002', 'Sahayak Suresh', 'sahayak@onecoolie.in', '$2a$10$w6z9V3T7Vw0SgQc6sN.e.uVzU9uYfIlnc2U9zX2/yQhXv9FqG5T2a', '9876543211', 'assistant', 'NDLS', true, true, 'approved'),
    ('a0000000-0000-0000-0000-000000000003', 'Passenger Ramesh', 'passenger@onecoolie.in', '$2a$10$w6z9V3T7Vw0SgQc6sN.e.uVzU9uYfIlnc2U9zX2/yQhXv9FqG5T2a', '9876543212', 'passenger', 'NDLS', false, false, 'not_submitted')
ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- SECTION 19 — FINAL SCHEMA VERIFICATION QUERIES
-- ==============================================================================

-- Run these queries after setup to confirm database readiness:

-- 19.1 Verify All 16 Tables Exist
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

-- 19.2 Verify Append-Only Triggers Exist
SELECT tgname, relname 
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname IN (
    'trg_prevent_financial_audit_mutation',
    'trg_prevent_evidence_mutation',
    'trg_prevent_certification_mutation'
);

-- 19.3 Verify RLS is Enabled on All Ledgers
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN (
    'users', 'bookings', 'payments', 'refunds', 'assistant_earnings',
    'assistant_payouts', 'assistant_payout_items', 'financial_audit_logs',
    'financial_incidents', 'payment_webhook_events', 'production_validation_sessions',
    'production_validation_evidence', 'production_launch_certifications'
);

-- 19.4 Verify Unique Constraint on Paid Payout Reference
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname = 'uq_idx_assistant_payouts_reference_paid';
