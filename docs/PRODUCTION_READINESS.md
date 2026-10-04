# Rotavoy launch audit — 4 October 2026

Base reviewed: master `12c21ca0d4a812cb0793559a8515adfbb8edec4e`.
Status: **not ready to open real-money sales**. This branch is preparation for continued sandbox testing, not a production activation.

## Keep testing

| Environment | Frontend | Backend | Provider |
| --- | --- | --- | --- |
| Local development | `npm run dev`; test UI remains | `NODE_ENV=development`, `ROTAVOY_ENV=development` | Existing sandbox key |
| Separate staging deployment | `VITE_ROTAVOY_ENV=staging` at build time | `NODE_ENV=production`, `ROTAVOY_ENV=staging` | Sandbox key only |
| Future production deployment | `VITE_ROTAVOY_ENV=production` (build default) | `NODE_ENV=production`, `ROTAVOY_ENV=production` | Production key only |

Sandbox card sessions remain available without enabling real bookings. Existing sandbox crypto checkout still requires `NUITEE_ENABLE_SANDBOX_BOOKING=true`; its BSC/Ethereum configuration uses **real mainnet funds**, despite the hotel reservation being sandbox. No on-chain payment was sent during this audit. Sandbox is not a blockchain testnet.

Use separate MongoDB databases and provider credentials for staging and production. Do not copy sandbox reservation records into production. Never set the public deployment to staging to bypass the environment checks.

## Changes in this branch

- Production cannot use sandbox hotel/flight inventory or create sandbox payments; startup rejects a mismatched provider environment.
- `NUITEE_ENABLE_LIVE_BOOKING` actually controls new live card sessions and finalization.
- New live crypto checkout is closed because current settlement is sandbox-only. This is a launch blocker, not a completed production integration.
- Checkout availability and payment logos reflect backend capabilities; test capabilities remain visible in local/staging when enabled.
- Card finalization claims a reservation atomically before calling the supplier. Concurrent redirects cannot submit two bookings. A supplier response must include `data.bookingId` and `data.status=CONFIRMED` before success is shown.
- Ambiguous booking errors remain pending for reconciliation instead of reverting to unpaid and blindly retrying. The UI supplies a status check/support path. An automated reconciliation worker is still required.
- New card references use 128 bits of randomness. This reduces guessability; it does not replace authenticated booking access (see blockers).
- Test card instructions remain in local/staging; a production UI refuses to mount the sandbox payment SDK.
- Removed public beta wording, old shopping wallet description, and unconditional sandbox language in all ten flight empty-result messages.
- Hero copy in all ten languages describes hotel discovery; unimplemented car/activity tabs remain in local/staging, hidden on production. Flight search/comparison remains available; ticket sales are not claimed.

## Launch blockers / next implementation work

1. **Supplier/account configuration**: verify production Nuitee credentials, live Payment SDK permission, margin/payout settings and receiving bank setup in the actual account. No deployment secrets or provider account settings were accessed here. SDK rendering in sandbox does not prove live payment eligibility.
2. **Crypto settlement** (`server/src/routes/hotels.js`): after mainnet verification the existing code calls `bookNuiteeSandbox`. Implement production settlement only after confirming the account funding method. LiteAPI `ACC_CREDIT_CARD` charges the card attached to our production account; receiving USDT does not fund Nuitee automatically. Verify supplier cost, margin, and required float before enabling.
3. **Crypto ownership and receipt validation** (`travelPaymentVerification.js`): a public transaction hash plus optional payer address is not proof of control. Bind the booking to an authenticated customer and signed wallet challenge (or use unique payment addresses). Verify chain ID, actual ERC-20 Transfer receipt events, payment timing, expiry/late arrivals, and atomic transaction consumption; add funded-chain tests for USDT/USDC/BNB/ETH on supported networks. Current code checks calldata and receipt success and does not bind payment block time to the booking.
4. **Reliable card reconciliation**: current completion depends on the browser returning. Implement verified provider events or a scheduled server-side reconciliation flow for browser closure, 3DS processing, provider timeout, and application crash after supplier success. Reconcile by provider booking/reference before retrying, retain paid-but-unconfirmed cases, and build the support/recovery workflow. The new lock deliberately avoids double submission; it cannot resolve an unknown provider outcome by itself.
5. **Booking access and recovery**: connect `TravelBooking` to the authenticated customer/guest session, authorize reads/finalization, retain booking detail and confirmation codes across browser restarts, and deliver reservation confirmation email/voucher. The current finalize endpoint uses the reference as access. Existing short references are not migrated by this branch.
6. **Cancellation/refunds/support**: define and exercise the operational cancellation/refund path against the provider, including a payment-success/booking-failure case; confirm the support mailbox works. Static information pages are not an implementation of these operations.
7. **Front-end account/config**: verify deployed `VITE_API_BASE_URL`, `VITE_REOWN_PROJECT_ID`, Firebase authorized domains/providers, HTTPS/CORS, database indexes/backups, and secrets. Reown configuration is currently mandatory at startup; without its project ID the app throws before rendering. API URL must point at the backend because Vercel has no `/api/hotels` proxy.
8. **Language coverage**: checkout and card UI still contain hardcoded Turkish while the catalog has ten languages. Complete checkout/success/failure/support localization before promoting the full multilingual product.
9. **Flights**: implemented search + verification only; passenger collection, flight prebooking, payment, booking and ticket issuance are absent. Keep it comparison-only until that flow is implemented and tested. Cars/activities have no backend integration.

## Verification

- `npm run check`: lint/build passed, 19 backend tests passed. Two pre-existing React hook dependency warnings remain in `Travel.jsx`; build reports large vendor chunks.
- New tests cover local/staging preservation, production sandbox rejection, live opt-in, disabled live crypto, supplier confirmation validation, route guards, concurrent finalization and ambiguous failure.
- `npm run security:check`: frontend/backend reported 0 high and 0 critical vulnerabilities (not a claim of zero lower-severity advisories).
- No real provider charge, blockchain transfer, reservation, cancellation, production deployment or database mutation was performed.
- Browser verification was attempted, but agent-browser could not start its daemon. No visual/browser pass is claimed. The temporary local Vite server was started with a fixture Reown ID only; it did not test actual wallet login.
- Account-level and true end-to-end payment tests are still outstanding.

## Acceptance before enabling live bookings

Exercise sandbox hotel search → selected dates/guests → prebook → successful card / 3DS / declined card → confirmation. Include simultaneous callbacks, reload, closing the browser, provider timeout, and cancellation. Then perform an explicitly approved controlled production transaction and verify the provider booking ID, actual charged amount, margin and confirmation delivery. Do not enable live crypto until items 2–3 are complete.

Primary provider references:
- https://docs.liteapi.travel/docs/account-credit-card
- https://docs.liteapi.travel/reference/post_rates-book
- https://docs.liteapi.travel/docs/direct-stripe-integration-stripe-elements
