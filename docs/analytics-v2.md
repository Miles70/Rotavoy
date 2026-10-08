# Analytics V2

Analytics runs independently of booking/payment operations. Deployment requires review of this branch; no production migration or historical deletion is required.

## Traffic semantics

| Type | Evidence | Default metrics |
| --- | --- | --- |
| visitor | V2 client and no exclusion signal | Included; not proof of a human |
| admin | Server-signed context issued after existing admin authentication | Excluded |
| test | Server-signed test context issued after existing admin authentication | Excluded |
| suspected_bot | Automation/crawler user-agent signal | Excluded; suspicion only |
| unknown | Legacy event/client, invalid/expired proof, or conversion without booking attribution | Excluded |

No IP, country, VPN, account email, or browsing pattern establishes admin/test identity. Legacy `bot: true` becomes suspected bot at read time; other unclassified historical records remain unknown. Historical records are not deleted or relabeled based on guesses. Existing legacy analytics API stays available behind the same admin authentication.

Admin proof issuance uses the current password credential version, an 8-hour expiry and HMAC authentication. Password rotation invalidates outstanding proofs. Proofs confer **no admin API permissions**. Missing browser cookies or blocked storage can break visitor continuity; no fingerprint is constructed to reconstruct it. Signed proof is never returned by analytics reads, logged, or persisted to the analytics collection.

## Agent/browser tests

Before navigating to any real site page, call `markAnalyticsTest(context, { apiBaseUrl, adminToken })` from `scripts/analytics-test-context.mjs`. Use an existing authorized admin session token from the test environment; do not print or commit it. This obtains a signed test proof and seeds session storage before the first page view. Explicit test proof takes precedence over an admin session in that browser.

For completely intercepted/local fixture tests, `markAnalyticsTest(context, { fixture: true })` writes an unverified fixture marker. If a fixture request accidentally reaches a server, it is excluded (unknown/suspected), never silently accepted as standard visitor traffic. This fixture option is **not** a verified test label for real server tests. The analytics end-to-end test exercises actual signed issuance and storage.

## Metrics and attribution

- All counters, breakdowns, chart, visitor list and journeys share the date/country/source/traffic filters. Search and event-type selection additionally scope matching events (including funnel); clear these for the complete conversion journey. Country and source match exact values; inputs suggest values from current results.
- Default is the past seven days and standard visitor traffic. “All traffic” is explicitly mixed and must not be presented as customer-only statistics.
- Dates and daily buckets use UTC (labeled); individual event timestamps use the browser timezone. Calendar start/end dates include the full UTC dates.
- Daily chart fills zero days. Heartbeats are excluded from page-view/event counts and timelines.
- Active visitors have an event within 90 seconds inside the selected report filters. Visible tabs emit a heartbeat every 45 seconds; the panel refreshes every 30 seconds and can be paused. Background dashboard tabs do not poll.
- Funnel stages are ordered within a visitor/session pair. Repeated or early out-of-order events do not inflate the next stage. Direct checkout entries do not fabricate missing earlier stages.
- `payment_start` is a checkout attempt; `payment_ready` is payment-session creation, **not** paid status.
- `/api/visits/booking-ready` validates existing booking access and stores immutable attribution in the analytics collection. It does not modify the booking. `/booking-confirmed` validates access and reads `TravelBooking.status === confirmed`, then deduplicates by a hash of the booking reference. A public `/events` request cannot forge `booking_confirmed`.
- Conversion attribution uses the verified payment-ready event, preserving original test/admin/visitor classification across new browser sessions and redirects. Without original evidence, a standard-looking confirmation becomes unknown. Confirmations from old bookings therefore do not silently become new visitor conversions.
- Conversion capture is browser-assisted. A customer who never reaches the result page, blocks tracking, or loses booking access may not be counted. It is not a financial ledger; operational booking records remain authoritative. Hotel funnel and overall verified booking count are distinct; flight confirmations may be in the latter without hotel funnel stages.

## Data and access

New events do not store raw IP, email, customer ID, or city. Existing data is preserved. IP is used transiently for the pre-existing country lookup and bounded in-memory cache, never as classification evidence. V2 responses/CSV omit legacy identity and IP fields. Paths omit query/fragment; details use a bounded allowlist. Card data, guest forms and booking access tokens are not analytics fields. Booking references are used transiently for access checks and stored only as a SHA-256-derived event ID.

Reports use admin authentication, private/no-store responses, bounded pages/date ranges and a database timeout. New indexes support date/traffic and session/date access. Old endpoints and production checkout/provider contracts remain unchanged.

## Verification

```
npm ci
npm ci --prefix server
npm run lint
npm run build
npm run server:test
npm run test:hotel-ui
npx playwright install chromium
npm run test:hotel-e2e
# Local MongoDB only; a unique temporary database is created and removed.
ANALYTICS_TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:analytics-e2e
```

The analytics test refuses non-local MongoDB URLs and never reads production `MONGODB_URI`. It checks actual Express/Mongo aggregation and Chromium at 320/390/1440px in light/dark themes, classification, legacy preservation, date/filter scope, pagination, ordered funnel, protected/deduplicated conversions, visitor timeline, empty state and the browser ingestion queue. `CHROMIUM_EXECUTABLE_PATH` is an optional local test-browser override. Screenshots are in `test-results/analytics-v2` and uploaded by CI.

Rollout after approval: deploy backend support before the new frontend. Old clients are safely marked unknown during a staggered rollout. No data rewrite is necessary. Rollback to the old UI leaves V2 metadata and all history intact.
