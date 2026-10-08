# Browser analytics tests

Before an agent navigates a browser to Rotavoy for testing, seed an analytics test context using `scripts/analytics-test-context.mjs` as documented in `docs/analytics-v2.md`. Real server tests must obtain a server-signed proof using an authorized admin session. Fully intercepted fixture tests use the fixture marker. Never infer test traffic from IP/country, print authentication tokens, or send unmarked browser tests to production analytics.
