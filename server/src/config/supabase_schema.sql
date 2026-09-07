-- ============================================================
-- RAILMITRA DATABASE RESET & SCHEMA CREATION SCRIPT
-- SQL #1: COMPLETE DATABASE RESET + CREATION
-- ============================================================

-- 1. DROP EXISTING APPLICATION TABLES SAFELY
-- (Dropping tables with CASCADE automatically drops all attached triggers)
DROP TABLE IF EXISTS sos_alerts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. USERS TABLE
-- ============================================================
CREATE TABLE users (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. BOOKINGS TABLE
-- ============================================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT UNIQUE NOT NULL,
    passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES users(id) ON DELETE SET NULL,
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
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. SOS ALERTS TABLE (Emergency Event Log)
-- ============================================================
CREATE TABLE sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
    station_code TEXT NOT NULL,
    train_no TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_station ON users(station_code);
CREATE INDEX idx_users_online ON users(is_online) WHERE role = 'assistant';

CREATE INDEX idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX idx_bookings_assistant ON bookings(assistant_id);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_station ON bookings(station_code);
CREATE INDEX idx_bookings_created ON bookings(created_at DESC);
CREATE INDEX idx_bookings_sos ON bookings(sos_triggered) WHERE sos_triggered = TRUE;

-- ============================================================
-- 6. AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_bookings
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role on users" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on bookings" ON bookings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service role on sos_alerts" ON sos_alerts
    FOR ALL USING (true) WITH CHECK (true);
