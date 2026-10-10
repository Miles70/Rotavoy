# VoyHaven Travel

Migration from Rotavoy is prepared on `feat/voyhaven-migration`. See [the migration runbook](docs/voyhaven-migration.md) for domain/provider gates and the static retirement deployment.

VoyHaven is a multilingual travel platform focused on hotel discovery, live Nuitee room availability, hotel details, prebooking, reservation checkout and travel payments.

The former shopping / dropshipping catalog has been moved out of VoyHaven. VoyHaven now has one job: travel.

## Local development

Requirements: Node.js 22+, npm and MongoDB.

```bash
npm ci
npm --prefix server ci
cp .env.example .env
cp server/.env.example server/.env
npm run server:dev
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000`  
Health: `http://localhost:5000/api/health`

## Travel stack

- React / Vite frontend
- Express / MongoDB backend
- Nuitee / LiteAPI hotel inventory
- Firebase customer authentication
- Reown / Wagmi wallet support
- BNB Chain USDT payment verification
- 10-language travel UI and hotel-content localization

## Production

Frontend configuration:

- `VITE_API_BASE_URL`
- `VITE_REOWN_PROJECT_ID`
- `VITE_SUPPORT_EMAIL`

Backend configuration is documented in `server/.env.example`.

Never commit local `.env` files or production credentials.

## Travel administration

The Travel admin at `/admin` uses a password form, independently of customer authentication. Every `/api/admin` endpoint requires its own server-validated admin session.

Set `ROTAVOY_ADMIN_PASSWORD` in **server/.env** or your backend hosting environment to a private password of at least 12 characters, then restart or redeploy the backend. Never commit its value or expose it in frontend `VITE_*` variables. An empty or invalid configuration disables admin login. Sessions last eight hours; logout revokes them and changing the password invalidates existing sessions.

Available operations: real hotel booking/payment lists, search and pagination, booking details and operational notes (new checkouts also save informational hotel/stay selections), customer directory, CSV export of the current page, indexed hotel showcase visibility/priority, support/cancellation/refund request tracking, editorial destination/campaign/guide drafts, provider configuration status, commission settings for new hotel searches, and an audit trail of admin writes. Gross paid totals remain separated by currency and are not net commission or provider payouts.

Support/refund records do not cancel provider reservations or transfer money. Editorial `ready` records are not automatically published. Flight ticketing, rental/activity providers, payout reconciliation, granular staff roles and scheduled publishing are explicitly shown as pending integrations. Existing booking/payment execution remains the checkout flow; the admin does not offer manual “mark paid/confirmed” overrides.

## Travel release verification

Run `npm run check` before publishing. On the backend host run `npm run check:readiness` from the repository root (or `npm run check:readiness` inside `server` with its `.env` loaded). This prints configuration presence only, never credential values, and never charges a card.

Production needs `NODE_ENV=production`, a production `NUITEE_API_KEY`, `NUITEE_ENABLE_LIVE_BOOKING=true`, MongoDB, Firebase project for customers, admin password and HTTPS `CLIENT_ORIGINS`. Build the frontend with `VITE_API_BASE_URL` set to the backend HTTPS origin. Production rejects sandbox keys. Local card testing with a sandbox key remains available in development.

Hotel cards use Nuitee Payment SDK. Flights use Nuitee flight prebooks with Payment SDK and Stripe Payment Element; Nuitee must enable production flights for the account. Checkout revalidates flight price, passenger counts, birth dates and travel documents. A successful payment alone never marks a reservation confirmed: upstream `CONFIRMED` and a booking ID are required.

Crypto hotel payments are verified on the selected mainnet, including transfer receipts, amount, recipient, block timestamp and duplicate transaction protection. The hotel cost is then settled using `NUITEE_ACCOUNT_PAYMENT_METHOD` (`ACC_CREDIT_CARD`, `WALLET` or `CREDIT`). A funded/approved provider payment method is required. Real crypto cannot be accepted for sandbox hotel bookings. VoyHaven does not automatically refund blockchain transfers when a provider cannot confirm; resolve paid but unconfirmed records through admin/support.

Reservation capability tokens protect guest checkout records; signed-in customers can also access their own records. Interrupted hotel booking calls are reconciled by client reference, without blindly resubmitting. A backend worker reconciles processing records after browser closure. Unpaid card sessions are not automatically charged; payment-return finalization is required. Unknown provider outcomes remain processing for follow-up instead of showing fabricated success.

Automated tests use isolated provider/DB fixtures. They do not establish that production account permissions, real 3DS, actual ticket issuance, provider account funding or live database connectivity work. Complete one provider-authorized live verification before accepting public sales. Car rental and activities remain information sections until a supplier is connected.

