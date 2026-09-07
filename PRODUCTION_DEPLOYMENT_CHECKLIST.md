# ONECOOLIE — Production Deployment & Security Readiness Checklist (Phase 6)

This document provides step-by-step procedures for deploying the ONECOOLIE / RailMitra platform to production with full payment security, ledger consistency, and operational observability.

---

## 1. Pre-Deployment Database Migrations

Before starting the server, ensure all database migrations have been executed on the production Supabase PostgreSQL instance in order:

- [ ] **Phase 1–2B Migration**: Tables `bookings`, `payments`, `users`, `assistants`
- [ ] **Phase 2C Migration**: Table `payment_webhook_events` (for webhook deduplication & raw payload replay safety)
- [ ] **Phase 3A Migration**: `payment_phase3a_migration.sql` (table `refunds`, refund ledger, cancellation reversal columns)
- [ ] **Phase 3B Migration**: `payment_phase3b_migration.sql` (tables `assistant_earnings`, `assistant_payouts`, `assistant_payout_items`)
- [ ] **Phase 5 Migration**: `payment_phase5_migration.sql` (tables `financial_audit_logs`, `financial_incidents`, indexes, triggers)

Verify all 9 financial tables exist before promoting traffic:
1. `bookings`
2. `payments`
3. `refunds`
4. `assistant_earnings`
5. `assistant_payouts`
6. `assistant_payout_items`
7. `financial_audit_logs`
8. `financial_incidents`
9. `payment_webhook_events`

---

## 2. Environment Variables & Secret Configuration

Configure production environment variables on the backend hosting provider (e.g., Render, Railway, AWS ECS, DigitalOcean):

- [ ] `NODE_ENV=production`
- [ ] `PORT=5000` (or host-assigned port)
- [ ] `CLIENT_URL=https://onecoolie.in`
- [ ] `ALLOWED_ORIGINS=https://onecoolie.in,https://admin.onecoolie.in` (no trailing slashes, no wildcards in production)
- [ ] `SUPABASE_URL=https://<your-project-ref>.supabase.co`
- [ ] `SUPABASE_KEY=<publishable-anon-key>`
- [ ] `SUPABASE_SECRET_KEY=<service-role-secret-key>` (REQUIRED: do not use anon key for backend)
- [ ] `JWT_SECRET` (generate with `openssl rand -hex 32` — at least 32 characters)
- [ ] Email credentials: `BREVO_API_KEY` or `RESEND_API_KEY` configured

---

## 3. Razorpay Live Mode Activation

Transitioning from Razorpay Test mode to Live mode:

- [ ] Obtain Razorpay **Live** API Keys from the Razorpay Dashboard (`https://dashboard.razorpay.com`):
  - `RAZORPAY_KEY_ID`: Must start with `rzp_live_`
  - `RAZORPAY_KEY_SECRET`: Secret key matching live key ID
- [ ] Configure Razorpay Webhook in Razorpay Dashboard:
  - **Webhook URL**: `https://<api-domain>/api/payments/webhook`
  - **Secret**: Set a strong random secret and copy to `RAZORPAY_WEBHOOK_SECRET`
  - **Active Events to Subscribe**:
    - `payment.captured`
    - `payment.failed`
    - `refund.processed`
- [ ] Verify frontend receives `RAZORPAY_KEY_ID` (Key ID only — NEVER expose Key Secret or Webhook Secret)

---

## 4. Reverse Proxy & Network Hardening

- [ ] **Trust Proxy**: Enabled via `app.set('trust proxy', 1)` in `server/src/index.js` for accurate rate limiting and IP capture behind NGINX / Cloudflare.
- [ ] **SSL / TLS**: Enforce HTTPS on all routes; HSTS headers automatically set by Helmet.
- [ ] **Content Security Policy (CSP)**:
  - `scriptSrc`: `"'self'", "https://checkout.razorpay.com"`
  - `frameSrc`: `"'self'", "https://api.razorpay.com"`
  - `connectSrc`: `"'self'", "https://api.razorpay.com", "wss:", "ws:"`
- [ ] **Webhook Endpoint Exemption**:
  - Webhook route `/api/payments/webhook` consumes `express.raw({ type: 'application/json' })` BEFORE `express.json()`
  - Webhook route is NOT rate-limited by standard client limiters

---

## 5. Automated Verification & Readiness Health Check

Execute the following checks immediately following deployment:

1. **Liveness Probe**:
   ```bash
   curl -i https://<api-domain>/health
   # Expected: HTTP 200 { "status": "ok", "service": "onecoolie-api" }
   ```

2. **Readiness Probe**:
   ```bash
   curl -i https://<api-domain>/ready
   # Expected: HTTP 200 { "status": "READY" | "WARNING", "checks": { ... } }
   # If HTTP 503 is returned, inspect the missing components in the JSON body.
   ```

3. **Admin Production Readiness Report**:
   ```bash
   curl -i https://<api-domain>/api/admin/finance/production-readiness \
     -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
   ```

4. **Secret Leakage Inspection**:
   - Verify that neither `/health`, `/ready`, `/api/admin/finance/production-readiness`, nor any error stack trace contains secret strings or database passwords.

---

## 6. Option C Hybrid Model Operating Rules

- **Cash Payments**:
  - Settled on-site between passenger and Sahayak.
  - Cash bookings are immediately dispatchable upon creation.
- **Online Payments**:
  - Gated strictly by Razorpay payment confirmation.
  - Unpaid online bookings remain in `PENDING_PAYMENT` quarantine and CANNOT be assigned or dispatched.
  - **Admins are strictly prohibited from manually marking online payments as `paid`**.
- **Sahayak Payouts**:
  - Sahayaks submit payout withdrawal requests from their wallet balance.
  - Admins review and manually transfer funds via standard bank/UPI rails.
  - Admin inputs bank UTR / reference number.
  - Duplicate settlement reference numbers are strictly blocked with HTTP 409 Conflict.
  - Zero automated banking payout APIs are connected, preventing unauthorized external balance drains.

---

## 7. Incident Response Protocol

- Any invariant violation detected by `reconciliationService` automatically logs a `CRITICAL` incident into `financial_incidents`.
- Admins can inspect open incidents at `/api/admin/incidents`.
- Transition states: `OPEN` -> `INVESTIGATING` -> `RESOLVED` (requires `admin_notes` >= 5 characters).
