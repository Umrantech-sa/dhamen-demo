# Dhamen Escrow Console — Umran Tech demo

A realistic, clickable demo of the **Dhamen Pay-In / Pay-Out integration (Integration Guide v1.5)** built with Next.js 16, Tailwind v4 and shadcn/ui.

The backend is a **mock Dhamen API** that implements every service in the guide with the same URLs, HTTP methods, Appendix A headers, request/response objects and error codes. State is persisted as a single JSON document: `data/db.json` locally, Upstash Redis on Vercel. Everything you do in the UI survives restarts.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

The first request seeds ~30 days of realistic history (customers, suppliers, payments in every state, payouts, ledger and webhook notifications). Reset any time from **Settings → Reset demo data**.

```bash
pnpm smoke          # 42 API checks against http://localhost:3000 (pass another base URL as an argument)
```

## Deploy to Vercel (free)

Vercel functions can't write to the filesystem, so the deployed demo stores its data in **Upstash Redis** (free tier). Every tester shares the same sandbox.

1. Push this repo to GitHub, then on [vercel.com/new](https://vercel.com/new) import it. Keep the defaults: `vercel.json` pins pnpm 11 and the Frankfurt region (`fra1`).
2. In the project go to **Storage → Create Database → Upstash (Redis)**. Choose the free plan and the `eu-central-1` (Frankfurt) region, then connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Redeploy** so the new env vars are picked up. The first visit seeds the sandbox.

Settings → Demo data shows which storage is active. If Redis isn't connected, the app still runs on in-memory storage that resets on each cold start.

Optional env vars: `DHAMEN_REDIS_PREFIX` (key prefix, default `dhamen-demo`), plus the `NEXT_PUBLIC_DHAMEN_*` values from `.env.example`.

Preview deployments are protected by Vercel Authentication by default, so webhook self-delivery there shows as _failed_. Production URLs are public and deliver normally.

## What you can do

| Area                 | Features                                                                                                                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customers**        | Create / edit (create-customer, update-customer), soft-delete & restore, search (name, ID, mobile, email, VIBAN), filters, sort, CSV export, live VIBAN balance, deposit money, per-customer ledger                                                                                          |
| **Suppliers**        | Create / edit, payout threshold, soft-delete, failed-transfer alerts, supplier balance, payout history with UTI, supplier-payment-status                                                                                                                                                     |
| **Payments**         | Payment links for one or many payers (split bill), registered or guest payers, pre-authorization, BNPL (Tabby), recurring; capture (full/partial), reverse, refund (full/partial), refund to IBAN, cancel link, subsequent charge, status check; timeline + API calls + webhooks per payment |
| **Hosted checkout**  | `/pay/{invoiceId}` with MADA/VISA/Mastercard detection, 3-D Secure OTP step, Tabby pay-in-4, test cards (success, declined, insufficient funds), expired/cancelled states, return URL                                                                                                        |
| **Escrow accounts**  | Authority VA, every customer/supplier VIBAN, card holds, double-entry ledger with filters                                                                                                                                                                                                    |
| **Payouts & splits** | Supplier payment builder (by amount or %), funding from authority VA or any customer VIBAN, insufficient-balance handling, threshold & scheduled payout cycles, SARIE success/failure with UTI                                                                                               |
| **SADAD**            | Issue bills (biller code + bill number), simulate payment                                                                                                                                                                                                                                    |
| **Notifications**    | All 10 Appendix B notification types, delivered in batches to a webhook (built-in receiver by default) with retries/resend                                                                                                                                                                   |
| **API console**      | Call all 19 endpoints with live pre-filled samples, toggle bad credentials, cURL, request log, error-code catalogue                                                                                                                                                                          |

A header **API** button opens an inspector with every request/response the dashboard sent.

## Sandbox rules

- A `customerIdentifier` that matches a registered customer's identity number is paid into that customer's VIBAN; any other identifier goes to the authority virtual account.
- Card payments settle T+1: use **Simulate settlement** (or **Settle pending** on Payments, or enable auto-settle in Settings). On settlement, funds for a `supplierId` move to the supplier VIBAN and are paid out when the balance reaches `payoutThresholdAmount`, otherwise on the next payout cycle.
- Supplier IBANs ending in 12 zeros are rejected by SARIE (`Failure_Transfer_Notification`), e.g. the seeded _Masar Car Rental_.
- Test cards: `4464 0400 0000 0007` MADA, `4111 1111 1111 1111` VISA, `5123 4500 0000 0008` Mastercard succeed; cards ending `0002`, `9995`, `0069` are declined. Any 6-digit OTP is accepted.

## Project layout

```
app/api/payments/*        Mock Dhamen endpoints (exact guide URLs)
app/api/demo/*            Sandbox-only helpers: list/search views, checkout, settlement, payout cycle, reset
app/(dashboard)/*         Console pages
app/pay/[invoiceId]       Hosted payment page
lib/dhamen/               Types, validation (zod), error codes, services (business rules), HTTP pipeline
lib/db/                   JSON store (serialized, atomic writes) and seed scenario
lib/client/               Browser API client, data hooks
components/               UI (shadcn/ui primitives in components/ui)
```

## Using the real Dhamen API

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_DHAMEN_BASE_URL` and the credentials. The dashboard's `dhamen.*` client (`lib/client/api.ts`) will call that host instead of the mock. In production, keep the App-key/App-id/ClientId on the server and proxy calls through your backend rather than exposing them to the browser. The list/search views under `/api/demo` are specific to this sandbox, because Dhamen doesn't expose list endpoints.
