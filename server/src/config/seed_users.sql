-- ============================================================
-- ONECOOLIE — SEED USERS FOR ADMIN, PASSENGER & ASSISTANT
-- Password for all accounts: Password@123
-- Bcrypt Hash (cost factor 10): $2b$10$Q2xQERu.XfTaqJ9ZLCuBIu0eHOucNNmJSOpzOZOeK6aa/w3zMBHVy
-- ============================================================

-- 1. ADMIN USER
INSERT INTO public.users (
    custom_id,
    name,
    email,
    password,
    role,
    phone,
    station_code,
    is_approved,
    is_online,
    kyc_status
)
VALUES (
    'ADM001',
    'Platform Administrator',
    'admin@onecoolie.com',
    '$2b$10$Q2xQERu.XfTaqJ9ZLCuBIu0eHOucNNmJSOpzOZOeK6aa/w3zMBHVy',
    'admin',
    '+919876543210',
    NULL,
    TRUE,
    TRUE,
    'approved'
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    is_approved = TRUE,
    is_online = TRUE,
    updated_at = now();

-- 2. PASSENGER USER
INSERT INTO public.users (
    custom_id,
    name,
    email,
    password,
    role,
    phone,
    station_code,
    is_approved,
    is_online,
    kyc_status
)
VALUES (
    'PSG001',
    'Rahul Sharma (Passenger)',
    'passenger@onecoolie.com',
    '$2b$10$Q2xQERu.XfTaqJ9ZLCuBIu0eHOucNNmJSOpzOZOeK6aa/w3zMBHVy',
    'passenger',
    '+919876543211',
    'KZJ',
    TRUE,
    FALSE,
    'approved'
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    is_approved = TRUE,
    updated_at = now();

-- 3. ASSISTANT / SAHAYAK USER
INSERT INTO public.users (
    custom_id,
    name,
    email,
    password,
    role,
    phone,
    station_code,
    is_approved,
    is_online,
    kyc_status
)
VALUES (
    'AST001',
    'Ramesh Sahayak (Assistant)',
    'assistant@onecoolie.com',
    '$2b$10$Q2xQERu.XfTaqJ9ZLCuBIu0eHOucNNmJSOpzOZOeK6aa/w3zMBHVy',
    'assistant',
    '+919876543212',
    'KZJ',
    TRUE,
    TRUE,
    'approved'
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    station_code = EXCLUDED.station_code,
    is_approved = TRUE,
    is_online = TRUE,
    kyc_status = 'approved',
    updated_at = now();
