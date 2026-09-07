# ONECOOLIE — Complete Technical Architecture & System Documentation

> **Ecosystem:** Smart Station Transit, Digital Porterage Marketplace & Real-Time Telemetry Platform for Indian Railways.  
> **Brand Identity:** ONECOOLIE (formerly RailMitra)  
> **Primary Pilot Network:** South Central Railway (SCR) — Secunderabad (`SC`), Vijayawada (`BZA`), Kazipet (`KZJ`), Warangal (`WL`).

---

## 1. Executive Summary & Core Mission

**ONECOOLIE** is a distributed, real-time web application engineered to modernize the unorganized Indian Railways station porterage ecosystem. 

It replaces platform haggling with a **standardized, fixed per-item tariff**, connects passengers directly with **verified, KYC-screened platform assistants (sahayaks)**, and coordinates luggage transit using a **two-tier hybrid Indian Railway telemetry engine** with **coach and seat-level navigation**.

### Key Value Propositions:
- **Transparent Fixed Tariffs:** ₹30/luggage item, ₹60 seat navigation, ₹80 wheelchair transit — no haggling on platforms.
- **Coach & Seat Door Service:** Assistants meet passengers either at the station entrance (Boarding) or at the train coach door (De-boarding).
- **Secure 6-Digit OTP Handshake:** Service cannot start until the assistant arrives and the passenger verifies their 6-digit secret OTP.
- **Two-Tier Telemetry Architecture:** 5,218+ all-India train catalogue for instant 0ms pre-booking, paired with live RapidAPI IRCTC feeds for real-time PNR and platform tracking.
- **Strict Single-Account Email Security:** Verified via automated 6-digit email OTP (Nodemailer Gmail SMTP).

---

## 2. System Architecture & Component Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATION (SPA)                           │
│  React 19 · Vite 8 · Tailwind CSS v4 · Three.js (WebGL) · Socket.IO Client  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS (REST) / WSS (WebSockets)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            BACKEND API GATEWAY                              │
│       Node.js (v25) · Express.js · Socket.IO Server · JWT / Bcrypt          │
└──────────────────┬──────────────────────────────────┬───────────────────────┘
                   │                                  │
┌──────────────────▼───────────────┐ ┌────────────────▼───────────────────────┐
│        DATA & STORAGE TIER       │ │      EXTERNAL TELEMETRY & COMMS        │
│   Supabase Managed PostgreSQL    │ │  • RapidAPI IRCTC Live Telemetry       │
│   RLS · Foreign Keys · JSONB     │ │  • Nodemailer TLS (Gmail SMTP)         │
│   5,218 All-India Trains Cache   │ │  • In-Memory Map Cache (90s TTL)      │
└──────────────────────────────────┘ └────────────────────────────────────────┘
```

---

## 3. Database Models & Schema Specifications

The database layer is deployed on **Supabase Managed PostgreSQL**, utilizing relational foreign keys, strict check constraints, automated timestamps, and JSONB document structures for customizable services.

```
┌──────────────────────┐       1:1       ┌──────────────────────┐
│        users         ├─────────────────┤      passengers      │
│  (id, email, role,   │                 │ (user_id, phone,     │
│   password_hash)     │                 │  emergency_contact)  │
└──────────┬───────────┘                 └──────────────────────┘
           │
           │ 1:1                         ┌──────────────────────┐
           ├─────────────────────────────┤      assistants      │
           │                             │ (user_id, station,   │
           │                             │  badge_no, rating)   │
           │                             └──────────┬───────────┘
           │ 1:N                                    │ 1:N
┌──────────▼───────────┐                 ┌──────────▼───────────┐
│      email_otps      │                 │       bookings       │
│ (otp_hash, email,    │                 │ (train_number, coach,│
│  purpose, attempts)  │                 │  seat, otp, jsonb)   │
└──────────────────────┘                 └──────────────────────┘
```

### 3.1 Model DDL & Field Definitions

#### A. Users Table (`users`)
Stores core identity for all system actors (passengers, assistants, admins).
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('passenger', 'assistant', 'admin')),
    station_code VARCHAR(10),
    is_approved BOOLEAN DEFAULT false,
    is_online BOOLEAN DEFAULT false,
    kyc_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### B. Bookings Table (`bookings`)
Orchestrates the lifecycle of transit assistance missions.
```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id VARCHAR(50) UNIQUE NOT NULL,
    passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    train_number VARCHAR(20) NOT NULL,
    train_name VARCHAR(255) NOT NULL,
    station_code VARCHAR(10) NOT NULL,
    source VARCHAR(100),
    destination VARCHAR(100),
    journey_date DATE NOT NULL,
    journey_time VARCHAR(20) NOT NULL,
    services JSONB DEFAULT '{}'::jsonb,
    service_description TEXT,
    total_price NUMERIC(10,2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'completed',
    payment_method VARCHAR(50) DEFAULT 'upi',
    booking_status VARCHAR(50) DEFAULT 'pending',
    assistant_status VARCHAR(50) DEFAULT 'assigned',
    start_otp VARCHAR(6) NOT NULL,
    start_otp_verified BOOLEAN DEFAULT false,
    rating INT,
    review TEXT,
    sos_triggered BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### C. Email OTP Security Table (`email_otps`)
Maintains cryptographic OTP tokens for registration and password resets.
```sql
CREATE TABLE email_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    attempts INT DEFAULT 0,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Services Data Model (JSONB Payload)
The `services` column in `bookings` stores structured service counts and rates:
```json
{
  "luggage": 2,
  "escort": true,
  "wheelchair": false,
  "language": false,
  "snacks": false,
  "transport": true,
  "coach": "B2",
  "seat_number": "45",
  "berth_type": "Lower Berth",
  "action_type": "boarding",
  "pnr": "4521890214",
  "platform": "1"
}
```

---

## 4. Codebase Structure & Directory Layout

```
Railmitra-main/
├── client/                               # Frontend Single Page Application
│   ├── public/
│   │   ├── favicon.svg                   # Brand Favicon
│   │   ├── icons.svg                     # Vector sprites
│   │   └── logo.png                      # App logo asset
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js                  # Preconfigured Axios instance with JWT interceptor
│   │   ├── assets/
│   │   │   └── hero.png                  # Marketing hero graphic
│   │   ├── components/
│   │   │   ├── ActiveBooking.jsx         # Live journey tracking & platform navigation card
│   │   │   ├── AssistantJobCard.jsx      # Real-time assistant dispatch card with coach/seat box
│   │   │   ├── Brand.jsx                 # Centralized typography & logo renderer
│   │   │   ├── ConfirmDialog.jsx         # Modal dialog for booking cancellation
│   │   │   ├── OfflineBanner.jsx         # Network connectivity status banner
│   │   │   ├── PaymentModal.jsx          # Digital checkout modal (UPI QR, Card, Cash)
│   │   │   ├── RailwayCanvas3D.jsx       # Three.js procedural 3D train & station canvas
│   │   │   ├── Skeleton.jsx              # Loading skeletons for responsive UX
│   │   │   ├── Toast.jsx                 # Toast notification provider
│   │   │   └── TrainSearch.jsx           # Smart autocomplete for 5,218 all-India trains
│   │   ├── context/
│   │   │   ├── AuthContext.jsx           # Global authentication state, login, register, OTP
│   │   │   ├── LanguageContext.jsx       # i18n localization context (EN, HI, TE)
│   │   │   ├── ProfileMenu.jsx           # User avatar dropdown and navigation menu
│   │   │   └── ThemeContext.jsx          # Light/Dark mode context manager
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx        # Operations monitoring, KYC approval, analytics
│   │   │   ├── AdminLogin.jsx            # Secure administrator portal
│   │   │   ├── AssistantDashboard.jsx    # Assistant radar, job acceptance & OTP entry
│   │   │   ├── AuthPage.jsx              # Unified login/register with 6-digit OTP verification
│   │   │   ├── BookingLive.jsx           # Dedicated live trip tracking room
│   │   │   ├── HomePage.jsx              # High-conversion marketing landing page
│   │   │   └── PassengerDashboard.jsx    # 3-step booking flow (PNR, Coach, Services)
│   │   ├── utils/
│   │   │   └── services.js               # Service meta, pricing rules, pilot stations list
│   │   ├── App.css                       # Global styles & animation keyframes
│   │   ├── App.jsx                       # Route hierarchy with ProtectedRoute guards
│   │   ├── index.css                     # Tailwind CSS v4 design tokens & utilities
│   │   └── main.jsx                      # React DOM mounting root
│   ├── package.json                      # Client dependencies & scripts
│   ├── vercel.json                       # Vercel deployment rewrite rules
│   └── vite.config.js                    # Vite 8 configuration with Tailwind v4 plugin
│
└── server/                               # Backend REST & WebSocket Service
    ├── src/
    │   ├── config/
    │   │   ├── db.js                     # Supabase client connection & environment loader
    │   │   ├── email_otps_migration.sql  # Migration script for email OTPs table
    │   │   └── supabase_schema.sql       # Canonical PostgreSQL DDL script
    │   ├── controllers/
    │   │   ├── adminController.js        # Analytics, assistant approval, KYC management
    │   │   ├── assistantController.js    # Location updates, online/offline status, stats
    │   │   ├── authController.js         # OTP generation, login, registration logic
    │   │   ├── bookingController.js      # Booking lifecycle, OTP verification, dispatches
    │   │   ├── serviceController.js      # Dynamic service catalogue & rate querying
    │   │   └── trainController.js        # Train search, PNR lookup, API key updates
    │   ├── data/
    │   │   ├── station_telemetry_cache.json # Persistent telemetry fallback snapshots
    │   │   └── trains.json               # 5,218 official All-India railway timetable index
    │   ├── middleware/
    │   │   ├── adminMiddleware.js        # Guard restricting routes to role === 'admin'
    │   │   └── authMiddleware.js         # JWT verification & request context hydration
    │   ├── routes/
    │   │   ├── adminRoutes.js            # Routes mounted at /api/admin
    │   │   ├── assistantRoutes.js        # Routes mounted at /api/assistants
    │   │   ├── authRoutes.js             # Routes mounted at /api/auth
    │   │   ├── bookingRoutes.js          # Routes mounted at /api/bookings
    │   │   ├── serviceRoutes.js          # Routes mounted at /api/services
    │   │   └── trainRoutes.js            # Routes mounted at /api/trains
    │   ├── services/
    │   │   └── railwayService.js         # Telemetry pipeline, clock filter, RapidAPI client
    │   ├── utils/
    │   │   ├── bookingFormatter.js       # Data normalization & anti-corruption layer
    │   │   ├── emailService.js           # Nodemailer transport & HTML email templates
    │   │   ├── generateToken.js          # JWT signing utility
    │   │   └── otpService.js             # Cryptographic OTP generator & bcrypt hasher
    │   └── index.js                      # Express HTTP & Socket.IO server entrypoint
    ├── .env                              # Environment configuration (Secrets, Keys, URLs)
    └── package.json                      # Backend dependencies & runtime scripts
```

---

## 5. Subsystems & Technical Workflows

### 5.1 Authentication Subsystem & Email Security
- **Signup Flow:** Passenger/Assistant fills Name, Email, Password. System calls `POST /api/auth/otp/send`. A 6-digit random code is hashed with bcrypt, saved to `email_otps` (10-minute expiry), and dispatched via Nodemailer Gmail SMTP.
- **Verification:** User enters the 6-digit code. `POST /api/auth/otp/verify-register` compares against the bcrypt hash. Upon success, user record is created in `users`.
- **Single-Account Policy:** Enforces that only one account may exist per verified email address.
- **Subsequent Sign-Ins:** Direct authentication using Email + Password via `POST /api/auth/login`. Returns signed JWT token (`id`, `role`, `exp: 30d`). No OTP is required for subsequent logins.

### 5.2 Two-Tier Railway Telemetry Engine
To eliminate third-party API costs while maintaining real-time accuracy, ONECOOLIE utilizes a **Two-Tier Hybrid Architecture**:

1. **Tier 1 (Internal Dataset — 5,218 Trains):**
   - Stored in `server/src/data/trains.json`.
   - Ingests all official Indian Railways schedules (Rajdhani, Shatabdi, Vande Bharat, Superfast, Express, Passenger).
   - Provides sub-10ms linear search and autocomplete for advance pre-booking with **zero API quota consumption**.
2. **Tier 2 (Real-Time Upstream — RapidAPI IRCTC):**
   - Queried via `https://irctc1.p.rapidapi.com/api/v3/getLiveStation` and `/getPNRStatus`.
   - Resolves live platform numbers, GPS delay in minutes, and PNR confirmed coach/berth positions.
3. **Dynamic Clock Synchronization Engine (`railwayService.js`):**
   - Automatically computes time difference (`diffMinutes`) against current Indian Standard Time (IST).
   - **Purges departed trains:** If a train departed more than 10 minutes ago, it is automatically removed from live arrival suggestions.
   - **Live window projection:** Suggests only upcoming trains in the active 4-hour forward window.

### 5.3 Luggage Mission & Coach/Seat Navigation
Passengers specify their precise platform target in Step 02:
- **Luggage Mission Type:**
  - 🚶 *Boarding (Load to Seat):* Assistant meets passenger at concourse/entrance, carries luggage to the platform, and places bags into the designated coach and berth.
  - 🚪 *De-boarding (Collect from Seat):* Assistant meets the train coach door upon arrival, collects baggage directly from the passenger's seat, and escorts them to the station exit or pre-booked taxi.
- **Seat Coordinates:**
  - Coach Number (e.g. `B2`, `S4`, `A1`)
  - Seat/Berth Number (e.g. `45`, `21`)
  - Berth Position (`Lower Berth`, `Middle Berth`, `Upper Berth`, `Side Lower`, `Side Upper`, `Window Seat`, `Aisle Seat`)

### 5.4 Real-Time WebSocket Protocol (Socket.IO)
- **Room Subscriptions:**
  - `socket.join("station_" + stationCode)`: Assistants listen for new incoming jobs at their assigned station.
  - `socket.join("booking_" + bookingId)`: Passengers and assigned assistants share private state updates.
- **Core Real-Time Events:**
  - `new_booking`: Broadcasted to station assistants when a passenger completes checkout.
  - `booking_assigned`: Emitted when an assistant accepts the job.
  - `assistant_location`: Streams assistant coordinates for live platform radar tracking.
  - `otp_verified`: Triggers when the passenger's 6-digit start OTP is validated.
  - `job_completed`: Finalizes the mission and initiates cashless wallet settlement.

---

## 6. API Reference & Contract Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/otp/send` | Send 6-digit email OTP | None |
| `POST` | `/api/auth/otp/verify-register` | Verify OTP & create account | None |
| `POST` | `/api/auth/login` | Direct email + password sign in | None |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Bearer JWT |

### Train Telemetry (`/api/trains`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/trains/search` | Search 5,218 trains & live active board | None |
| `GET` | `/api/trains/pnr-status` | Lookup 10-digit PNR PRS status | None (Rate-limited) |
| `GET` | `/api/trains/supported-stations` | List supported pilot stations | None |
| `POST` | `/api/trains/sync` | Auto-sync trains database from live API | None |
| `POST` | `/api/trains/update-key` | Hot-reload RapidAPI key dynamically | None |

### Bookings & Missions (`/api/bookings`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/bookings` | Create new transit assistance booking | Bearer (Passenger) |
| `GET` | `/api/bookings/my-trips` | Fetch passenger's trip history | Bearer (Passenger) |
| `GET` | `/api/bookings/:id` | Fetch live details for specific booking | Bearer (Any) |
| `PUT` | `/api/bookings/:id/accept` | Assistant accepts dispatch job | Bearer (Assistant) |
| `PUT` | `/api/bookings/:id/verify-otp` | Verify 6-digit passenger start OTP | Bearer (Assistant) |
| `PUT` | `/api/bookings/:id/complete` | Complete luggage mission | Bearer (Assistant) |
| `PUT` | `/api/bookings/:id/cancel` | Cancel booking & release assistant | Bearer (Passenger) |

---

## 7. Environment Configuration (`.env`)

The backend requires the following configuration parameters in `server/.env`:

```env
# Server Port & Allowed Origin
PORT=5000
CLIENT_URL=http://localhost:5173

# Supabase Managed PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-secret-service-role-key

# Authentication Secrets
JWT_SECRET=your-jwt-secret-key

# Email OTP Gateway (Gmail SMTP TLS)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-16-char-app-password
OTP_FROM_NAME=OneCoolie
OTP_EXPIRY_MINUTES=10

# Indian Railway Telemetry Upstream (RapidAPI IRCTC)
TRAIN_API_KEY=your-rapidapi-key
TRAIN_API_HOST=irctc1.p.rapidapi.com
TRAIN_API_BASE_URL=https://irctc1.p.rapidapi.com/api/v3
```

---

## 8. Setup, Installation & Execution Guide

### Prerequisites
- Node.js `v20.0.0` or higher (tested on `v25.2.1`)
- npm `v10.0.0` or higher

### 1. Backend Server Setup
```bash
cd server
npm install
npm start
# Server listens on port 5000 (http://localhost:5000)
```

### 2. Frontend Client Setup
```bash
cd client
npm install
npm run dev
# Vite dev server runs at http://localhost:5173
```

### 3. Production Build Validation
```bash
cd client
npm run build
# Compiles assets to client/dist with Rolldown/Vite
```

---

## 9. Master Credentials for System Verification

| Portal | URL | Demo Credentials |
| :--- | :--- | :--- |
| **Public Landing Page** | `https://onecoolie.vercel.app/` | Public |
| **Passenger Portal** | `https://onecoolie.vercel.app/auth` | `passenger@railmitra.com` / `password123`<br>*(or register new account with email OTP)* |
| **Assistant Portal** | `https://onecoolie.vercel.app/assistant-auth` | `assistant@railmitra.com` / `password123` |
| **Admin Operations Console** | `https://onecoolie.vercel.app/admin-auth` | `admin@onecoolie.in` / `password123`<br>*(or `admin@railmitra.com`)* |
