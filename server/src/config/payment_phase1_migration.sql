-- ============================================================
-- ONECOOLIE — PAYMENT SYSTEM PHASE 1 DATABASE MIGRATION
-- Adds dedicated `payments` and `assistant_earnings` tables.
-- Preserves existing `bookings`, `users`, and `sos_alerts` data.
-- Run in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PAYMENTS TABLE (Authoritative payment ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT CHECK (payment_method IN ('cash', 'online', 'upi', 'card', 'netbanking')),
    payment_gateway TEXT,
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_signature TEXT,
    status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')) DEFAULT 'pending',
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_passenger_id ON payments(passenger_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Enable RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role on payments" ON payments
    FOR ALL USING (true) WITH CHECK (true);

-- Trigger for payments updated_at
CREATE TRIGGER set_timestamp_payments
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. ASSISTANT EARNINGS TABLE (Commission & Sahayak share)
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    gross_amount NUMERIC(10, 2) NOT NULL CHECK (gross_amount >= 0),
    platform_commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.00 CHECK (platform_commission_percent >= 0 AND platform_commission_percent <= 100),
    platform_commission_amount NUMERIC(10, 2) NOT NULL CHECK (platform_commission_amount >= 0),
    assistant_amount NUMERIC(10, 2) NOT NULL CHECK (assistant_amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'available', 'held', 'paid_out', 'reversed')) DEFAULT 'pending',
    available_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_assistant_earnings_booking UNIQUE (booking_id)
);

-- Assistant Earnings Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_assistant_id ON assistant_earnings(assistant_id);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_booking_id ON assistant_earnings(booking_id);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_status ON assistant_earnings(status);
CREATE INDEX IF NOT EXISTS idx_assistant_earnings_created_at ON assistant_earnings(created_at DESC);

-- Enable RLS for assistant_earnings
ALTER TABLE assistant_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role on assistant_earnings" ON assistant_earnings
    FOR ALL USING (true) WITH CHECK (true);

-- Trigger for assistant_earnings updated_at
CREATE TRIGGER set_timestamp_assistant_earnings
BEFORE UPDATE ON assistant_earnings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Note on legacy columns:
-- `bookings.payment_status`, `bookings.payment_method`, and `bookings.payment_id`
-- are preserved for zero-downtime backward compatibility. `payments.status`
-- serves as the new authoritative payment source of truth.
