-- ============================================================
-- ONECOOLIE — PAYMENT SYSTEM PHASE 3A DATABASE MIGRATION
-- Adds dedicated `refunds` ledger table.
-- Preserves existing `payments`, `bookings`, and `assistant_earnings`.
-- Run in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. REFUNDS TABLE (Authoritative refund ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    passenger_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_gateway TEXT DEFAULT 'razorpay',
    gateway_refund_id TEXT,
    gateway_payment_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'cancelled')) DEFAULT 'pending',
    reason TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Refunds Indexes for fast lookup, reconciliation and accounting
CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_passenger_id ON refunds(passenger_id);
CREATE INDEX IF NOT EXISTS idx_refunds_gateway_refund_id ON refunds(gateway_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at DESC);

-- Enable RLS for refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role on refunds" ON refunds
    FOR ALL USING (true) WITH CHECK (true);
