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
