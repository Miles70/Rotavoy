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
