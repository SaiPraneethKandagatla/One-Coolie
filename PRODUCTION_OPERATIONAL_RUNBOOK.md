# ONECOOLIE — Production Operational Runbook & Incident Playbook (Phase 7)

This runbook provides standard operating procedures (SOP), incident remediation playbooks, and disaster recovery guidelines for the ONECOOLIE / RailMitra platform.

---

## 1. System Architecture & Topology Overview

```text
Passenger / Fleet Client (SPA)
        │
        ▼ (HTTPS / TLS 1.3)
Reverse Proxy (Cloudflare / NGINX)
        │
        ▼
Node.js Express + Socket.IO Server (Backend)
  ├── Trust Proxy: Enabled
  ├── Helmet CSP & Rate Limiting
  ├── Structured JSON Logging & Request ID
  └── Liveness (/health) & Readiness (/ready)
        │
        ├── Razorpay Checkout API (Frontend SDK)
        ├── Razorpay Webhook Ingestion (POST /api/payments/webhook)
        └── Supabase PostgreSQL Cloud (Service Role RPC & Row-Level Ledgers)
```

---

## 2. Observability & Real-Time Probes

### 2.1 Liveness Probe
- **Endpoint**: `GET /health` or `GET /api/health`
- **Expected Output**: HTTP 200 `{ "status": "ok", "service": "onecoolie-api" }`
- **Interpretation**: Confirms the Node.js event loop is responsive and HTTP ingress is healthy.

### 2.2 Readiness Probe
- **Endpoint**: `GET /ready` or `GET /api/ready`
- **Expected Output**: HTTP 200 `{ "status": "READY" | "WARNING", "checks": { ... } }`
- **Error Condition**: HTTP 503 if any core table is unreachable or critical reconciliation invariants fail.

### 2.3 Production Readiness Evaluation
- **Endpoint**: `GET /api/admin/finance/production-readiness`
- **Authentication**: `Authorization: Bearer <ADMIN_JWT>`
- **Usage**: Run immediately after deployments to verify the database schema, webhook configuration, and reconciliation health.

---

## 3. Database Backup, Migration & Rollback Strategy

### 3.1 Backup Protocols
1. **Daily Automated Snapshots**: Enabled via Supabase Automated Daily Backups with Point-in-Time Recovery (PITR).
2. **Pre-Deployment Logical Backup**:
   ```bash
   # Export schema & data prior to applying new migrations
   pg_dump "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
     --format=custom --file="backup_pre_deploy_$(date +%Y%m%d_%H%M%S).dump"
   ```

### 3.2 Additive Migration Policy
- Production migrations must **NEVER** drop existing columns, rename ledger tables, or drop indexes without a multi-phase deprecation cycle.
- All ledger tables (`payments`, `refunds`, `assistant_earnings`, `financial_audit_logs`, `payment_webhook_events`) are **append-only**.

### 3.3 Rollback Protocol
- If a deployment failure occurs:
  1. Revert container/app service image to the previous release tag.
  2. For additive columns: leave columns in place; no rollback DDL is needed as previous code ignores them.
  3. If data corruption occurred: utilize Supabase PITR to restore to the timestamp before the deployment window.

---

## 4. Payment Investigation Playbooks

### 4.1 Scenario A: Online Payment Stuck in "Pending" (> 15 Minutes)
- **Symptom**: Booking remains in `PENDING_PAYMENT` and is hidden from the Sahayak fleet radar.
- **Diagnostic Steps**:
  1. Open Admin Dashboard -> Finance -> **Stuck Payments Recovery** tab (`/api/admin/finance/payment-recovery`).
  2. Copy the `razorpay_order_id` or `payment_id`.
  3. Query Razorpay Dashboard (`https://dashboard.razorpay.com`) -> **Transactions**:
     - **If payment was captured on Razorpay**: Click "Trigger Webhook Replay" in Razorpay or verify HMAC signature via frontend recovery flow.
     - **If payment was aborted or abandoned by passenger**: The payment will remain `pending` or transition to `failed`. Do NOT manually mark as paid!
     - **If passenger requests cash alternative**: Cancel the pending booking; instruct the passenger to book with **Cash On Service** which is immediately dispatchable.

> [!CAUTION]
> **Zero Manual Override Rule**: Never execute an SQL update setting `payment_status = 'paid'` on an online booking. Online bookings must only be finalized through authenticated Razorpay webhook events or HMAC signature verification.

### 4.2 Scenario B: Duplicate Webhook Events
- **Symptom**: Razorpay retries webhook deliveries.
- **Resolution**:
  - The platform checks table `payment_webhook_events` by `event_id`.
  - Duplicate deliveries are acknowledged with HTTP 200 (`idempotent: true`) without emitting duplicate WebSocket broadcasts or creating duplicate ledger rows.

---

## 5. Sahayak Payout Settlement Procedures (Option C Model)

### 5.1 Manual Payout Workflow
1. Sahayak initiates withdrawal from wallet balance (minimum ₹100).
2. Funds transition from `available_balance` to `held_balance`.
3. Admin reviews payout in Admin Console -> **Sahayak Payouts**.
4. Admin approves request -> transitions status to `processing`.
5. Admin executes bank transfer / UPI payment to Sahayak's registered account.
6. Admin enters settlement details:
   - `payout_reference`: Bank UTR or UPI Transaction Reference (3-100 characters).
   - `payout_method`: `bank_transfer`, `upi`, `imps`, or `neft`.
7. Admin clicks **Mark Paid**.
8. Linked earnings permanently transition from `held` to `paid_out`.

### 5.2 Duplicate Reference Rejection (HTTP 409)
- If an admin inadvertently re-enters an already used UTR reference:
  - System rejects the update with `HTTP 409 Conflict`.
  - Admin must verify the banking receipt and input the distinct transaction reference.

---

## 6. Financial Reconciliation & Invariant Violations

### 6.1 Automated Reconciliation Engine
- Run on demand via `GET /api/admin/finance/reconciliation`.
- Evaluates 10 core invariants:
  1. Platform commission (20%) + Assistant share (80%) = Total fare.
  2. Refund ceiling: Total refunds ≤ Total payment amount.
  3. State exclusivity: Earnings cannot be both `paid_out` and `reversed`.
  4. Payout consistency: Paid payouts must link only to `paid_out` earnings.
  5. Reservation integrity: Held earnings must map to an active payout.
  6. Earning uniqueness: Zero duplicate payout claims on the same earning.
  7. Ledger parity: Booking amount equals sum of valid payment transactions.
  8. Ownership integrity: Linked payout items belong to the assigned assistant.
  9. Online gating invariant: Unpaid online bookings are never visible on radar.
  10. Option C integrity: Cash payments cannot have Razorpay order IDs.

### 6.2 Incident Remediation
- Any invariant failure automatically registers a `CRITICAL` incident into `financial_incidents`.
- Admin reviews incident details at `/api/admin/incidents`.
- Transition states: `open` -> `investigating` -> `resolved` (requires `admin_notes` ≥ 5 characters).
