-- ============================================================
-- RAILMITRA — Email OTP Table Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pzrttunhyfporcpcybax/sql
-- ============================================================

-- Create email_otps table
CREATE TABLE IF NOT EXISTS email_otps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  otp_hash     TEXT NOT NULL,          -- bcrypt hash of the 6-digit OTP
  purpose      TEXT NOT NULL           -- 'login' or 'signup'
               CHECK (purpose IN ('login', 'signup')),
  expires_at   TIMESTAMPTZ NOT NULL,   -- server-enforced expiry
  used         BOOLEAN DEFAULT FALSE,  -- true once verified (prevents reuse)
  attempts     INTEGER DEFAULT 0,      -- failed attempt counter (brute-force guard)
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_otps_email   ON email_otps(email);
CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON email_otps(expires_at);

-- Enable RLS
ALTER TABLE email_otps ENABLE ROW LEVEL SECURITY;

-- Allow server (service-role) full access — same pattern as users/bookings tables
CREATE POLICY "Allow all operations for service role on email_otps" ON email_otps
  FOR ALL USING (true) WITH CHECK (true);

-- Optional: clean up expired OTPs automatically
-- DELETE FROM email_otps WHERE expires_at < now() OR used = true;
