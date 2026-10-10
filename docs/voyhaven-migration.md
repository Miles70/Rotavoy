# VoyHaven migration

Canonical origin: `https://voyhaven.com`. `www.voyhaven.com` redirects to the apex.

## Preserve the existing system

Keep `Miles70/Rotavoy`, all Git history, the existing Railway service and MongoDB database. Do not rename the database, Firebase project, provider credentials, wallet address or existing `ROTAVOY_*` environment variables. These identifiers are compatibility contracts, not customer branding. Existing booking records and payment reconciliation must remain available.

The Vercel project remains `rotavoy`; infrastructure names do not require another deployment or another backend. During validation the new apex domain targets `feat/voyhaven-migration`, while Rotavoy continues to serve master.

The migration updates customer-visible names in all ten language dictionaries, reservation summaries, admin, checkout, wallet metadata, SEO, HTML titles and Open Graph tags. It adds a lightweight vector VoyHaven wordmark and favicon. Hotel IDs, hotel content provenance hashes and booking routes stay intact. Both hotel and flight card-return URLs already derive from `window.location.origin`.

Support continues to use the existing `VITE_SUPPORT_EMAIL` mailbox. Do not publish `support@voyhaven.com` until the mailbox/forwarder is actually configured and tested.

## Settings and external gates

1. Railway `CLIENT_ORIGINS`: preserve existing entries and append `https://voyhaven.com,https://www.voyhaven.com`. Deploy this environment change on the existing service. Do not create a second service. Do not rename its `rotavoy-production.up.railway.app` hostname during migration; the existing Vercel API base URL remains valid.
2. Vercel: keep `VITE_API_BASE_URL`, `VITE_REOWN_PROJECT_ID` and the current support email. Add VoyHaven to this project. After verification, clear the apex domain's temporary branch assignment so it follows production, and merge the validated migration branch. Preserve Rotavoy's deployment until all gates below pass.
3. Cloudflare: add the new zone using the Free plan, import and inspect all required DNS records, then use the exact nameservers Cloudflare assigns at Porkbun. Never reuse the Rotavoy zone's nameservers by assumption. Set the apex A and www CNAME to the actual values returned by Vercel's domain configuration; preserve MX/TXT records. Initially keep web records DNS-only for domain/TLS validation. Enable proxy only after confirming HTTPS and avoiding redirect loops.
4. Nuitee Connect: confirm the existing production account and Payment SDK may operate at `https://voyhaven.com`. Update website/trading brand wherever the account exposes them; confirm accepted payment origins, hotel/flight callback or return URLs, 3DS behavior and booking permissions. Keep the same API key and provider account unless Nuitee explicitly requires otherwise. Production flight permissions must be verified independently of hotel access.
5. Firebase Authentication: retain project `rotavoy`; add `voyhaven.com` and `www.voyhaven.com` to authorized domains and validate provider redirect requirements. Test existing customer login; passwords and accounts must not be recreated. Sessions stored in a browser's localStorage do not transfer between domains, so customers/admins sign in again at VoyHaven. Existing server booking ownership still applies.
6. Reown Dashboard: authorize VoyHaven on the existing project's domain allowlist. Verify wallet connection and crypto payment network/amount handling.
7. Search Console: retain the old verified property and verification file; create and verify the VoyHaven domain property and submit `https://voyhaven.com/sitemap.xml`. Every new canonical and reciprocal hreflang must use the new origin. A static retirement page alone does not transfer old page rankings; if preserving indexed deep-link traffic matters, prepare matching path-level permanent redirects after cutover and before the static catch-all. Do not forward checkout/payment reference query parameters automatically.

## Required validation before retiring Rotavoy

- Vercel build/CI and domain DNS/TLS verification are successful.
- Hotel showcase, city search, pagination, room details and prebook conditions work on VoyHaven against the existing production API.
- Flight search and selected-offer verification work; establish live flight booking entitlement explicitly.
- Customer and admin authentication, reservations/account records, analytics and all ten languages work on VoyHaven.
- The correct production payment session, 3DS and return/reconciliation work on the new domain. No documented domain pre-approval requirement was found; support ticket LAS-3030 requests account branding updates and confirmation of account-specific requirements. Provider test environments validate charge flows; do not charge or create a real booking without separate transaction authorization.
- Reown connects a wallet; crypto checkout preserves the existing receiving address, network validation, replay protection and account-backed booking.
- Support email delivery and DNS records are confirmed.

## Rotavoy static retirement

`legacy/rotavoy-static/` is a self-contained deployment: no scripts, API requests, secrets, functions or Railway connection. It contains a bilingual retirement page linking to VoyHaven and a Vercel static configuration.

Only after the gates above pass, deploy this directory as a static Vercel project and move **only** `rotavoy.com` and `www.rotavoy.com` to it (or serve an equivalent static host-based route). Keep VoyHaven on the existing application project and keep the existing Railway service running for VoyHaven. A static Vercel project adds no second Railway backend; hosting plan costs must still be checked against the user's actual account. If configured path redirects are desired, place them before the static catch-all.

After confirming both domains' final behavior and resolving any in-progress old-origin payment redirects, remove old frontend origins from Railway if no longer needed. Retain the old domain registration and repository/history.

## Rollback

Do not delete the old deployment or change provider credentials. Before retirement, reverting only VoyHaven's domain assignment/DNS restores isolation while Rotavoy continues on master. After merging, restore the previous known-good commit/deployment if needed. Keep MongoDB and payment records; never use database deletion or a new database as rollback.

## Validation recorded on 2026-10-10

- Local production build passed; 100 SEO pages generated in ten languages.
- SEO checks passed (canonical, reciprocal hreflang, schema, sitemap, 404 and private noindex).
- Hotel UI checks passed in ten languages.
- All 46 backend tests passed.
- Lint passed with two pre-existing Travel.jsx hook dependency warnings.
- VoyHaven DNS/TLS is valid in Vercel; the user opened the site and admin on the new domain.
- Firebase authorized domains now include both VoyHaven domains; the user successfully tested customer Google sign-in.
- The shared OpenTheSMM Reown project includes both VoyHaven domains; the user successfully connected MetaMask.
- Nuitee production rates/prebook and the card form loaded on VoyHaven; payment completion, 3DS and confirmed bookings are not yet verified.
- VoyHaven Search Console domain ownership was verified and its sitemap submitted. Google processing is pending.
- Production support ticket LAS-3030 is open. No support reply or approval has been assumed.

## SEO migration redirects

`vercel.json` includes host-scoped permanent redirects for every published multilingual SEO path and the six general sitemap pages. Old public hotel links map to their new canonical path. Only requests on `rotavoy.com` / `www.rotavoy.com` match; VoyHaven and previews cannot loop. Checkout, account, admin, unknown paths and requests carrying booking/payment parameters or active checkout/offer/language parameters are excluded so ongoing old-origin payment finalization remains available. The old backend origins and Railway service remain in place.

Deploy and verify these redirects on the old hostname before submitting Search Console Change of Address. Retain redirects for at least one year. Do not replace the old app with the static retirement deployment until outstanding booking-flow checks and old-origin sessions are resolved.
