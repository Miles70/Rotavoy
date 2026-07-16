# Rotavoy API

## Local setup

1. Copy `.env.example` to `.env`.
2. Put your MongoDB Atlas connection string in `MONGODB_URI`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
4. Install dependencies with `npm install` inside the `server` folder.
5. Start the API with `npm run dev`.
6. Start the Vite frontend from the project root with `npm run dev`.

The frontend sends local `/api` requests through the Vite proxy to `http://localhost:5000`.

> Important: the current product catalog remains in the existing `rotavoy` MongoDB database. Do not rename that database until a separate catalog migration is performed.

## Store endpoints

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:productKey`
- `POST /api/orders`
- `GET /api/orders/:orderNumber?email=customer@example.com`

## Admin endpoints

- `POST /api/admin/login`
- `GET /api/admin/session`
- `GET /api/admin/dashboard`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:orderNumber`
- `GET /api/admin/products`
- `PATCH /api/admin/products/:productKey`

All admin endpoints except login require an `Authorization: Bearer <token>` header. Admin sessions expire after 12 hours and are generated automatically by the server. Restarting the server clears active admin sessions.

Order totals are recalculated on the server from the MongoDB product catalog. Client-submitted prices and totals are ignored.
