# Travel SEO foundation

## Scope

The first phase makes the existing hotel and flight landing pages discoverable in all ten supported languages. It does not publish a destination catalogue, invent hotel inventory, or claim improved search rankings.

Before this change, flights were marked `noindex`, language selection only changed browser state, and the sitemap omitted hotel and flight landing pages. The initial SPA HTML contained generic metadata and no meaningful travel content.

## Delivered

The canonical origin is `https://www.rotavoy.com`, matching the verified live Vercel redirect from the apex domain. Sitemap locations, alternate links, structured data and canonical metadata all use this origin. Search Console should track the www URL-prefix property or a DNS-verified Domain property that covers both hosts.

- Twenty public landing URLs: English `/hotels` and `/flights`; other languages use `/{language}/hotels` and `/{language}/flights` for `tr`, `ru`, `ar`, `zh`, `es`, `pt`, `fr`, `de`, `it`.
- Build-generated initial HTML with localized title, description, canonical, ten reciprocal language alternatives plus English `x-default`, WebPage structured data, and useful visible travel guides. The same guide component appears in the running application; there is no crawler-specific response.
- URL language takes precedence over saved preference. The language selector preserves search parameters and URL fragments. Legacy hotel detail, account, reservation and checkout paths remain unchanged.
- A shared head manager replaces initial metadata during SPA navigation, preventing duplicate title, description, canonical and robots tags.
- A sitemap with 27 real routes and language alternatives. `/travel` canonicals point to `/`; duplicate `/en/hotels` and `/en/flights` redirect to English landing URLs.
- Checkout/account/admin routes retain access controls and receive `X-Robots-Tag: noindex, follow`. Checkout remains crawlable so search engines can read that instruction. Unknown application routes have client-side `noindex`; the existing SPA hosting fallback still returns HTTP 200 for them.
- Hotel detail metadata uses actual loaded hotel name, address and image when available, omits query parameters from the canonical, and marks failed detail loads `noindex`. Detail pages remain client rendered in this phase.
- A small RTL correction keeps the header login preview inside the viewport.

No Nuitee, Stripe, booking, payment, authentication or analytics backend code changes are required. Static page generation calls no inventory providers. CI uses a dummy public Reown project identifier for isolated browser fixtures, not a production credential.

## Validation

`npm run build` generates the twenty documents after Vite. `npm run test:travel-seo` checks every document with JavaScript disabled and tests the built application at 390px and 1440px, including Arabic RTL, metadata uniqueness, language switching with search parameters, overflow and private route indexing rules. All browser contexts are marked as analytics fixtures before navigation, API responses are intercepted, and external network requests are blocked.

The existing multilingual hotel UI, desktop/mobile booking regression and backend tests remain part of CI. `npm run lint` has two existing hook dependency warnings in Travel.jsx; this change adds no lint errors.

## Next phase

1. Review the deployed response headers, redirects and raw HTML after an approved deployment; local tests validate the configuration but cannot prove the hosting platform applied it.
2. Connect or inspect Google Search Console ownership, submit `/sitemap.xml`, and record indexing and search performance baselines. Submission and indexing have not been verified in this phase.
3. Build destination pages from verified hotel inventory with useful destination-specific content and accurate internal links. Do not generate thin pages for every filter combination.
4. Add server-rendered hotel detail pages and localized detail URLs only when stable catalogue data and provider caching limits are established. Never expose dated rates as permanent structured offers.
5. Improve actual page-load performance, validate remaining unknown-route HTTP status behavior, and audit the rest of the site's language and content coverage.

## References

- [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: localized page versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: multilingual and multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [Google: block indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
