# Rotavoy Travel API

Rotavoy's backend now serves travel and authentication only.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set the MongoDB connection string in `MONGODB_URI`.
3. Configure the Nuitee sandbox or live credentials.
4. Configure the BNB Chain USDT payment variables if crypto checkout is enabled.
5. Install dependencies with `npm install`.
6. Start the API with `npm run dev`.

The Vite frontend proxies local `/api` requests to `http://localhost:5000`.

## Active API areas

- `GET /api/health`
- `/api/customer-auth/*` for customer authentication
- `GET /api/hotels/status`
- `GET /api/hotels`
- `GET /api/hotels/:hotelId`
- `POST /api/hotels/rates`
- `POST /api/hotels/prebook`
- `POST /api/hotels/checkout`
- `POST /api/hotels/:clientReference/verify-payment`

Product catalog, cart, shopping orders, CJdropshipping, marketplace admin and campaign APIs have been removed from Rotavoy.
