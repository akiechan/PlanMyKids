# Subscription Test Scenarios

## Overview

Two subscription types:
1. **Featured Business** — weekly ($98/week) or monthly ($298/month), with 3-day free trial option
2. **Family Planner** — free, monthly ($8.50/month), or yearly ($65/year)

---

## 1. Subscription Canceled

### Featured Business — Cancel

**Steps:**
1. Go to `/billing`
2. Find an active featured subscription
3. Click "Cancel Subscription"
4. Confirm the cancellation dialog

**Expected behavior:**
- Stripe: `cancel_at_period_end: true` (subscription stays active until period ends)
- DB: `canceled_at` is set, `status` remains `active`
- Billing page: badge shows "Canceling" (orange), "Active Until [date]" shown
- Programs/Camps page: listing remains featured (star badge, top placement) until period ends
- Cancel button disappears, "Reactivate" button appears
- Upgrade/downgrade buttons hidden while canceling

**After period ends (Stripe webhook `customer.subscription.deleted`):**
- DB: `status` set to `canceled`, `is_featured` set to `false` on the program
- Programs/Camps page: listing no longer featured (no badge, normal sort order)
- Billing page: shows "Canceled" status

### Family Planner — Cancel

**Steps:**
1. Go to `/billing`
2. In the Family Planner section, click manage through Stripe portal

**Expected behavior:**
- API returns `cancelAtPeriodEnd: true`, `status: 'cancelling'`
- Dashboard shows orange warning: "Your Pro plan is ending on [date]"
- All Pro features remain accessible until period ends
- After period ends: plan shows as `free`, no active Stripe subscription
- If user has > 1 kid, > 1 adult, or > 5 programs: red warning shows "Your plan has been downgraded"
- User can still view existing data but cannot add beyond free limits

---

## 2. Subscription Upgraded

### Featured Business — Weekly to Monthly

**Steps:**
1. Go to `/billing`
2. Find a weekly featured subscription
3. Click "Upgrade to Monthly"
4. Review the upgrade modal (shows $98/week → $298/month with 24% savings)
5. Click "Confirm Upgrade"
6. Redirected to Stripe Billing Portal

**Expected behavior:**
- API: `proration_behavior: 'always_invoice'` — user charged prorated amount NOW
- Stripe creates a prorated invoice immediately
- DB: `plan_type` updated to `monthly`, `stripe_price_id` updated
- Modal text: "You'll be charged a prorated amount now for the upgrade"
- New monthly billing starts at next cycle
- Listing remains featured throughout

### Family Planner — Monthly to Yearly

**Steps:**
1. Go to `/billing`
2. In Family Planner section (monthly subscriber), click "Switch to Yearly (Save 36%)"
3. Review the upgrade modal ($8.50/month → $65/year, save $37/year)
4. Click "Confirm Switch"
5. Redirected to Stripe Billing Portal

**Expected behavior:**
- API: `proration_behavior: 'always_invoice'` — user charged prorated amount NOW
- Stripe creates a prorated invoice for yearly price minus remaining monthly credit
- Modal text: "You'll be charged a prorated amount now for the upgrade"
- New yearly billing starts at next cycle
- All Pro features remain active

---

## 3. Subscription Downgraded

### Featured Business — Monthly to Weekly

**Steps:**
1. Go to `/billing`
2. Find a monthly featured subscription
3. Click "Switch to Weekly"
4. Review the downgrade modal ($298/month → $98/week = ~$392/month)
5. Click "Confirm Switch"
6. Redirected to Stripe Billing Portal

**Expected behavior:**
- API: `proration_behavior: 'none'` — NO charge now
- Current monthly pricing continues until period ends
- At next billing cycle: charged $98/week instead
- DB: `plan_type` updated to `weekly` immediately
- Modal text: "Your change will take effect at your next billing date"
- Listing remains featured throughout

### Family Planner — Yearly to Monthly

**Steps:**
1. Go to `/billing`
2. In Family Planner section (yearly subscriber), click "Switch to Monthly"
3. Review the downgrade modal ($65/year → $8.50/month = $102/year)
4. Click "Confirm Switch"
5. Redirected to Stripe Billing Portal

**Expected behavior:**
- API: `proration_behavior: 'none'` — NO charge now
- Current yearly pricing continues until period ends
- At next billing cycle: charged $8.50/month instead
- Modal text: "Your change will take effect at your next billing date"
- All Pro features remain active

---

## 4. Subscription Reactivated

### Featured Business — Reactivate (Still in period)

**Steps:**
1. Cancel a featured subscription (so it shows "Canceling")
2. Click "Reactivate" button

**Expected behavior:**
- Stripe: `cancel_at_period_end` set to `false`
- DB: `canceled_at` cleared, status remains `active`
- Billing page: badge returns to "Active", normal buttons restored
- Listing stays featured continuously

### Featured Business — Reactivate (Period expired)

**Steps:**
1. Have a fully expired featured subscription
2. Click "Reactivate" button

**Expected behavior:**
- API creates a new Stripe Checkout session (new subscription)
- User redirected to Stripe to complete payment
- Cycle restarts today (new `current_period_start`)
- On successful payment (webhook): DB status set to `active`, `is_featured` set to `true`
- Listing becomes featured again

### Family Planner — Reactivate

**Steps:**
1. Cancel family planner and wait for period to end
2. Go to `/premium` or `/billing` and subscribe again

**Expected behavior:**
- New Stripe Checkout session created
- Cycle restarts from today
- On payment: Pro features immediately available

---

## 5. Subscription Added (Multiple Featured)

### Add Additional Featured Business

**Steps:**
1. Already have one active featured subscription
2. Go to `/featured` and click "Get Started" for a different program
3. Complete Stripe Checkout for the new listing

**Expected behavior:**
- New Stripe subscription created (separate from existing one)
- Separate billing cycle — each subscription has its own `current_period_start/end`
- Separate charges — each billed independently
- Both programs show as featured in Programs/Camps pages
- Both appear in `/billing` as separate cards
- Each can be independently canceled, upgraded, or downgraded
- If one is canceled, the other remains unaffected

### Verify Independent Cycles

**Expected behavior:**
- Subscription A (weekly, started Jan 1): bills every 7 days from Jan 1
- Subscription B (monthly, started Jan 15): bills every month from Jan 15
- Canceling A does not affect B
- Upgrading A does not affect B's billing cycle
- Each subscription's `current_period_end` tracked independently

---

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/subscriptions` | GET | List all subscriptions (featured + planner) |
| `/api/user/subscriptions/[id]/cancel` | POST | Cancel featured subscription (cancel_at_period_end) |
| `/api/user/subscriptions/[id]/reactivate` | POST | Reactivate canceled/canceling subscription |
| `/api/user/subscriptions/change-plan` | POST | Upgrade or downgrade plan |
| `/api/stripe/webhook` | POST | Handle Stripe events (subscription.updated, deleted) |

## Stripe Proration Summary

| Action | `proration_behavior` | User Charged |
|--------|---------------------|--------------|
| Upgrade (weekly→monthly, monthly→yearly) | `always_invoice` | Immediately (prorated) |
| Downgrade (monthly→weekly, yearly→monthly) | `none` | At next cycle |
| Cancel | N/A (`cancel_at_period_end`) | Nothing — runs until period end |
| Reactivate (still in period) | N/A | Nothing — removes cancel flag |
| Reactivate (expired) | New Checkout session | Full price, new cycle today |
