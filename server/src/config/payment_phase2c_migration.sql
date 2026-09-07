-- ============================================================
-- ONECOOLIE — PAYMENT SYSTEM PHASE 2C DATABASE MIGRATION
-- Adds `payment_webhook_events` audit and deduplication ledger.
-- Preserves existing `payments`, `bookings`, and `assistant_earnings`.
-- Run in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PAYMENT WEBHOOK EVENTS TABLE (Webhook audit & deduplication)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway TEXT NOT NULL DEFAULT 'razorpay',
    event_type TEXT NOT NULL,
    gateway_event_id TEXT UNIQUE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    payload JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook Events Indexes for fast lookup and deduplication
CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway_event_id ON payment_webhook_events(gateway_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON payment_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_booking_id ON payment_webhook_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON payment_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON payment_webhook_events(created_at DESC);

-- Ensure gateway_order_id on payments is indexed for fast webhook lookup
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order_id ON payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id ON payments(gateway_payment_id);

-- Enable RLS for payment_webhook_events
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role on payment_webhook_events" ON payment_webhook_events
    FOR ALL USING (true) WITH CHECK (true);
