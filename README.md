# Rotavoy

Rotavoy is a multilingual marketplace for shopping, travel and local discovery. The repository contains a Vite/React frontend and an Express/MongoDB backend with Firebase customer authentication, admin tools, stock reservation and on-chain USDT payment verification.

## Local development

Requirements: Node.js 22+, npm and a MongoDB deployment.

```bash
npm ci
npm --prefix server ci
cp .env.example .env
cp server/.env.example server/.env
npm run server:dev
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` requests to the backend at `http://localhost:5000`.

## Quality checks

```bash
npm run check
npm audit --omit=dev --audit-level=high
npm --prefix server audit --omit=dev --audit-level=high
```

The same checks run in GitHub Actions for pushes and pull requests targeting `master`.

## Production

The frontend is configured for Vercel through `vercel.json`. Set these frontend variables in Vercel:

- `VITE_API_BASE_URL`: public Railway backend URL without a trailing slash
- `VITE_REOWN_PROJECT_ID`: Reown project identifier
- `VITE_SUPPORT_EMAIL`: public support address

The backend is configured for Railway through `railway.toml`. Set every variable documented in `server/.env.example`; use the production Vercel origins in `CLIENT_ORIGINS` as a comma-separated allowlist.

Never commit `.env` files or production credentials.
