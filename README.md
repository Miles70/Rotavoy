# Rotavoy Travel

Rotavoy is a multilingual travel platform focused on hotel discovery, live Nuitee room availability, hotel details, prebooking, reservation checkout and travel payments.

The former shopping / dropshipping catalog has been moved out of Rotavoy. Rotavoy now has one job: travel.

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

The Travel admin is available at `/admin` (separate from the customer site). It uses the same Google/Facebook or signed wallet login, with administrator authorization enforced by the server on every `/api/admin` endpoint.

Set at least one allowlist in **server/.env** or your backend hosting environment, then restart the backend:

```dotenv
ROTAVOY_ADMIN_EMAILS=your-verified-login-email@example.com
# Alternatively, use a wallet address you own and authenticate by signing:
ROTAVOY_ADMIN_WALLETS=
```

Existing `ADMIN_EMAIL` configuration is also supported when `ROTAVOY_ADMIN_EMAILS` is empty. An explicit Travel email list takes precedence. The email setting must be in the backend environment (`server/.env` for local development). Comma-separated identities are supported. Firebase email identities must be verified; guest accounts never receive admin access. Empty allowlists deny all access. Do not place these settings or provider secrets in frontend `VITE_*` variables.

Available operations: real hotel booking/payment lists, search and pagination, booking details and operational notes (new checkouts also save informational hotel/stay selections), customer directory, CSV export of the current page, indexed hotel showcase visibility/priority, support/cancellation/refund request tracking, editorial destination/campaign/guide drafts, provider configuration status, commission settings for new hotel searches, and an audit trail of admin writes. Gross paid totals remain separated by currency and are not net commission or provider payouts.

Support/refund records do not cancel provider reservations or transfer money. Editorial `ready` records are not automatically published. Flight ticketing, rental/activity providers, payout reconciliation, granular staff roles and scheduled publishing are explicitly shown as pending integrations. Existing booking/payment execution remains the checkout flow; the admin does not offer manual “mark paid/confirmed” overrides.

## Travel release verification

Run `npm run check` before publishing. On the backend host run `npm run check:readiness` from the repository root (or `npm run check:readiness` inside `server` with its `.env` loaded). This prints configuration presence only, never credential values, and never charges a card.

Production needs `NODE_ENV=production`, a production `NUITEE_API_KEY`, `NUITEE_ENABLE_LIVE_BOOKING=true`, MongoDB, Firebase project/admin allowlist and HTTPS `CLIENT_ORIGINS`. Build the frontend with `VITE_API_BASE_URL` set to the backend HTTPS origin. Production rejects sandbox keys. Local card testing with a sandbox key remains available in development.

Hotel cards use Nuitee Payment SDK. Flights use Nuitee flight prebooks with Payment SDK and Stripe Payment Element; Nuitee must enable production flights for the account. Checkout revalidates flight price, passenger counts, birth dates and travel documents. A successful payment alone never marks a reservation confirmed: upstream `CONFIRMED` and a booking ID are required.

Crypto hotel payments are verified on the selected mainnet, including transfer receipts, amount, recipient, block timestamp and duplicate transaction protection. The hotel cost is then settled using `NUITEE_ACCOUNT_PAYMENT_METHOD` (`ACC_CREDIT_CARD`, `WALLET` or `CREDIT`). A funded/approved provider payment method is required. Real crypto cannot be accepted for sandbox hotel bookings. Rotavoy does not automatically refund blockchain transfers when a provider cannot confirm; resolve paid but unconfirmed records through admin/support.

Reservation capability tokens protect guest checkout records; signed-in customers can also access their own records. Interrupted hotel booking calls are reconciled by client reference, without blindly resubmitting. A backend worker reconciles processing records after browser closure. Unpaid card sessions are not automatically charged; payment-return finalization is required. Unknown provider outcomes remain processing for follow-up instead of showing fabricated success.

Automated tests use isolated provider/DB fixtures. They do not establish that production account permissions, real 3DS, actual ticket issuance, provider account funding or live database connectivity work. Complete one provider-authorized live verification before accepting public sales. Car rental and activities remain information sections until a supplier is connected.

## Current launch: travel enquiries

Public hotel/flight checkout routes now show a free enquiry form. Requests are saved in MongoDB and managed at `/admin/inquiries` (new, contacted, quoted, closed). Hotel, flight, car and activity requests do not create provider bookings or collect payment. The API blocks legacy checkout/payment/finalization POST routes by default, independently of old environment flags. Existing booking records are retained.

For this launch, `npm run check:readiness` checks MongoDB URL, provider catalog key, HTTPS frontend origins, Firebase project ID and admin allowlist. It does not require production booking or payment credentials and does not verify connectivity. Run the backend with `NODE_ENV=production`, MongoDB network access, `CLIENT_ORIGINS=https://rotavoy.com,https://www.rotavoy.com` and configured Firebase admin authentication. Build the frontend with its HTTPS `VITE_API_BASE_URL` and Firebase values. Set `NUITEE_ENABLE_LIVE_BOOKING=false`. Sandbox credentials may supply read-only hotel catalog/discovery and airport data; displayed hotel prices are suppressed and no live availability is promised. Provider permissions and real catalog availability still need verification.

Submit one enquiry on the deployed site and verify it in the admin before inviting visitors. Travel enquiries are not sent by email automatically; the admin is the operational inbox. Future direct bookings must be explicitly re-enabled in code and verified with the supplier first.
