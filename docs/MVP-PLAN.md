# Goozpokemon Initial MVP Plan

Goozpokemon will be a free, installable Pokemon card scanner that identifies a card, lets the collector confirm its printing, and displays its details and an attributed market price. Personal data and photos remain on the device. The MVP will be a static PWA hosted on GitHub Pages, deployed automatically when the user pushes to the `deploy` branch.

This plan is dated October 12, 2026. It covers implementation and release validation; it does not deploy an application by itself.

## Scope and planning assumptions

| Decision | MVP scope | Status |
| --- | --- | --- |
| Name | Goozpokemon | Confirmed |
| Core task | Scan a card, identify its exact printing, show details and price | Confirmed |
| Accounts | No sign-in or cloud collection storage | Confirmed |
| Hosting | Free GitHub Pages hosting | Confirmed |
| Release trigger | Push to the `deploy` branch | Confirmed |
| Languages | English physical cards | Confirmed |
| Pricing market | USD; US marketplace references | USD confirmed |
| Card type | Scan ungraded cards; also show PSA 9 and PSA 10 comparison prices | Confirmed |
| Capture | One card per capture; live camera and photo upload | Confirmed |
| Connectivity | Internet required for fresh details and prices; cache is optional convenience | Confirmed |
| Target devices | iPhone Safari and installed PWA; desktop Chrome and Edge | Confirmed |
| Pricing infrastructure | Free operation, with a small serverless proxy allowed to protect provider keys | Confirmed |

Collection catalogs, binders, portfolio totals, accounts, social features, buying/selling, sealed products, slab scanning, grade prediction, other graders, price charts, and multi-card photos are outside the MVP. PSA 9 and PSA 10 prices are comparison references for the identified raw card, not predicted grades or expected grading profits.

## Product flow

1. Open Goozpokemon to a scanner screen with a clear card frame, Capture, Upload photo, and Manual lookup actions. Explain camera permission at the moment it is needed.
2. Show the rear-camera preview. Guide the collector to fit the entire card inside the frame, reduce glare, and hold still. If camera access fails, offer upload and manual lookup immediately.
3. Capture one image and show a preview with Retake and Continue. Crop to the frame and allow correction of crop/rotation before recognition.
4. Process the image locally, with a visible progress state and Cancel. Detect weak input such as blur or an unreadable number and suggest a retake.
5. Show up to five ranked card candidates with thumbnail, name, set, and number. A strong match may open directly into a confirmation view, but it must not be presented as final until confirmed. Preserve a Change match action.
6. Let the collector confirm the exact card and choose its available printing, such as normal, holofoil, or reverse holofoil. Require edition confirmation when applicable. Do not automatically infer condition from the photo.
7. Show card details and separate Raw, PSA 9, and PSA 10 reference rows for the exact printing. Each row includes its own source, metric, currency, timestamp, and availability. Offer grade-specific eBay sold-search links for inspection.
8. Offer Scan another, Change match, and Refresh price. Keep the result available during the current session without creating a collection record.

Manual lookup searches by name, collector number, and set. It uses the same candidates, confirmation, and pricing flow, so correction never requires restarting the app.

## Screens and visible states

| Screen | Required content | Failure or alternate state |
| --- | --- | --- |
| Scanner | Camera preview, framing guide, capture/upload/manual controls | Permission denied, no camera, unsupported camera, camera busy |
| Photo review | Image, crop/rotation, retake, continue | Unsupported image, excessive file size, decode failure |
| Recognition | Progress, cancel | Unreadable photo, no candidates, timeout, worker failure |
| Match confirmation | Candidate images, set/number, change match, printing choice | Reprinted artwork, ambiguous edition, unsupported card |
| Card details | Name, image, set, number, rarity, category, available HP/types/artist | Missing optional fields must be omitted cleanly |
| Price panel | Raw, PSA 9, PSA 10 references; printing, USD, per-row source/dates, eBay sold-search links, refresh | No price for an individual grade, stale cache, offline, rate limit, provider failure |
| App information | Install guidance, privacy summary, version, clear cached data | Storage unavailable, update ready |

Use responsive layouts, readable camera controls, accessible focus/labels, and text alongside status colors. Support portrait phones without horizontal scrolling and respect reduced motion. Only show installation guidance that applies to the current platform.

## Technology and application structure

| Layer | Choice | Implementation responsibility |
| --- | --- | --- |
| UI | React and TypeScript | Screens, capture controls, match review, results |
| Build | Vite and npm lockfile | Reproducible static build and configurable hosting path |
| PWA | vite-plugin-pwa and Workbox | Manifest, app-shell cache, update lifecycle |
| Camera | Browser getUserMedia and file input | Rear-camera preference and upload fallback |
| Image processing | Canvas | Resize, crop, rotation, contrast adjustments; perspective correction only if needed by the benchmark |
| OCR | Tesseract.js in a reusable Web Worker | Local name, number, and set-code extraction |
| Catalog and prices | TCGdex REST adapter | Fetch, normalize, validate, and cache public data |
| PSA prices | Separate graded-price adapter and free serverless proxy | Protect API key and normalize exact PSA 9/10 comparisons; provider selection is a feasibility gate |
| Local database | Dexie over IndexedDB | Versioned catalog cache, detail cache, settings, price snapshots |
| Tests | Vitest and Playwright | Matching/pricing regressions and production-build browser workflows |

Start with plain CSS and reusable controls; a UI framework and global state library are unnecessary for the initial flow. Separate UI, recognition, matching, data-provider, pricing, and storage modules. Use a small explicit state machine for idle, preview, processing, selecting, and displaying states. Ignore stale async responses after a new scan or cancellation.

Suggested source layout: `src/features/scanner`, `src/features/card-details`, `src/domain`, `src/providers/tcgdex`, `src/storage`, and `src/pwa`. Add `tests/fixtures` for deterministic metadata and price examples, and `tests/e2e` for browser flows. Keep private photo benchmarks outside the public repository unless redistribution is explicitly permitted.

## Card recognition strategy

Recognition must prioritize exact identity rather than artwork similarity alone. The same Pokemon and artwork can appear in multiple sets and printings.

Begin with text extraction from card-name and footer regions. Preserve collector numbers as strings, including leading zeros, letters, promo prefixes, and numbers above the printed set total. Combine name, collector number, printed total, set code or symbol evidence, and other readable signals such as HP. Do not assume that the denominator uniquely identifies a set or that every card has a modern set code.

Build a small downloadable English catalog index containing IDs, names, set IDs/names, and collector numbers. Fetch details only for likely candidates. Validate provider filtering and catalog size during the first milestone; if the full index is too large, use set-partitioned indexes and explain which cached sets are available offline. Refresh the index without overwriting a valid cache with a partial download.

Normalize OCR errors conservatively, rank candidates using independent signals, and show uncertainty when evidence conflicts. Do not expose an uncalibrated score as an accuracy percentage. Keep OCR confidence distinct from match confidence and price completeness.

Foil treatment and condition cannot be reliably determined from one still image. Confirm printing explicitly. If edition or other price-relevant identity cannot be resolved, show a choice or withhold the quote. For unsupported printings, retain the identification and state that pricing is unavailable.

Benchmark OCR before investing in a complex scanner UI. If it fails the target, improve crop/quality checks and footer extraction, then evaluate local visual matching against catalog images. A cloud recognition service would change the privacy/cost architecture and requires a new product decision.

## Pricing contract

The primary headline metric is TCGplayer Market Price, obtained through TCGdex and labeled as a market reference for the selected printing. [TCGplayer describes this metric as based on completed sales](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price). Do not substitute listed median, low, or high asking prices into the headline when market price is absent.

[TCGdex documents](https://tcgdex.dev/markets-prices) printing-specific USD prices and update timestamps, with hourly-to-daily TCGplayer refreshes. Its documented response does not supply condition-specific valuations. Until a suitable feed is available, the UI must not claim that the reference values the user's actual worn card. Do not add condition selectors that appear to adjust a quote when they cannot do so.

Each normalized quote must include card ID, set, language, edition if known, printing, provider, marketplace, product ID/URL where available, metric, currency, amount, provider update time, and fetch time. Represent monetary amounts using validated decimal conversion and integer minor units, rather than floating-point arithmetic. Missing, null, invalid, or negative values are unavailable; a genuine numeric zero remains distinct from missing data.

Normalize actual provider variant keys, including `reverse-holofoil`, through an explicit mapping. Preserve unrecognized variants for diagnostics and never collapse them into normal or holo. Validate data at runtime. The earlier smoke check found differences between TCGdex documentation examples and live responses, so examples are not a schema guarantee.

Deduplicate simultaneous requests for a card, use abortable requests with a proposed 15-second timeout, and honor Retry-After on rate limits. Retry transient failures at most twice with backoff; do not retry missing products or malformed data. Preserve an existing valid quote when refresh fails and visibly label the failed refresh. A stale response from an earlier card must never replace the current result.

Refresh a selected card when its local fetch is more than one hour old, or when the collector requests a refresh. This is a request policy, not a promise of hourly source updates. Label provider data older than 48 hours as stale; also show its actual timestamp. These are proposed UX thresholds to tune during validation. If the timestamp is absent or invalid, show freshness unknown. Offline results are always labeled cached, even if recently fetched.

Never use a normal printing's quote for reverse holo, or one edition's quote for another. A feed with insufficient edition detail must produce pricing unavailable. Do not blend marketplaces or currencies. Product links must refer to the matched product; if no verified URL exists, omit the link rather than inventing one.

Pricing validation compares at least 30 representative card/printing pairs with the corresponding marketplace product and metric. Record source timestamps, condition scope, currency, and mapping. Explain every observed discrepancy; a live marketplace changing since the provider snapshot is distinct from a mapping bug. Require zero unresolved printing/edition/product mapping errors. If provider coverage or freshness is inadequate, narrow and clearly label supported coverage or choose another permitted provider before release. TCGCSV can be evaluated as a fallback feed, but it is not an independent second marketplace and does not supply individual sales.

## Data storage and privacy

Graded-price cache keys also include grading company and numeric grade. Raw, PSA 9, and PSA 10 entries must never overwrite one another.

| Stored item | Lifetime | Rules |
| --- | --- | --- |
| Captured photo | Current scan only | Keep in memory; release object URLs and buffers after retake, cancel, or next scan |
| OCR output and candidates | Current scan only | No persistent photo/OCR history in the MVP |
| Catalog index and card details | Cached across sessions | Version records, retain provider IDs and fetch dates |
| Price snapshots | Cached across sessions | Key by exact identity, marketplace, currency, metric, and printing; retain source/fetch times |
| Settings | Across sessions | Camera preference and install/update dismissals; no personal profile |

Use a Goozpokemon-specific database name and bounded caches. Initial proposal: at most 200 card-detail records and 500 quote records, evicting least recently used entries; catalog indexes are managed separately. Cap image caching by storage budget. Handle quota failures by dropping expendable caches, keeping the current result usable, and notifying the user only when necessary.

IndexedDB failure must allow an online in-memory session. Provide Clear cached data in app information. No analytics, tracking SDK, user account, or photograph upload is needed. Catalog, image, and price requests contact third-party providers and reveal normal request metadata; explain that in the privacy summary. Browser cache retention is not a guarantee, so collection persistence/export must be designed when collections are added later.

## Offline behavior and PWA updates

The app shell and icons are available offline after successful installation/caching. Host and cache OCR worker, WASM, and English language assets from our own deployment, with their required licenses. Load the larger recognition assets on first scan and make readiness visible; offline OCR is unavailable until those assets finish downloading.

Offline lookup works only against downloaded catalog indexes and details. A successful OCR extraction with no cached match offers to retry online; it does not fabricate details. Cached prices show their source date and an offline indicator. Refresh is disabled or explains why it cannot run. Do not promise a complete offline catalog in the MVP.

Use an update prompt and activate a new service worker between scans. Avoid refreshing mid-capture or mid-recognition. Version app caches and clean obsolete assets without deleting the local database. Test upgrading an installed app with existing cached data.

## GitHub Pages deployment from deploy

Use `.github/workflows/deploy.yml` with a push trigger restricted to `deploy`. Development stays on `main` or feature branches; pushing those branches runs checks but does not publish. The deployment workflow builds the actual `deploy` commit and uploads `dist` to Pages. It does not commit generated files back to a branch.

Deployment stages:

1. Check out the pushed commit and install a pinned supported Node LTS version.
2. Run `npm ci` from the committed lockfile.
3. Run formatting/lint checks, TypeScript checking, unit tests, and a production build.
4. Serve the built app at its configured repository path and run deterministic Playwright smoke tests with mocked catalog/pricing data. Install the required browser in CI.
5. Configure Pages and upload only `dist` using the official Pages artifact action.
6. Deploy through the official Pages deployment action with the `github-pages` environment and display the returned URL in the workflow summary.

Use job-scoped least privileges: build needs `contents: read`; deployment needs `pages: write` and `id-token: write`. Pin third-party action references to verified commits when implementing. Use a shared Pages concurrency group to serialize publication, allowing an active deployment to finish rather than interrupting it. Failed build/test jobs must leave the last successful site published.

Use a separate `.github/workflows/ci.yml` for pull requests and pushes to `main`. Reuse validation commands rather than maintaining divergent checks. Live provider availability must not determine routine CI success; run a separate manual integration check before release and record its result.

One-time setup requires a GitHub repository, a remote URL, and Pages configured with GitHub Actions as its source. For free hosting, use a public repository. Configure `github-pages` environment rules to allow `deploy`; no mandatory reviewer is needed for the requested automatic release flow. GitHub's [custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) covers the artifact, permissions, and environment requirements.

The final GitHub repository name determines the hosting path, not the app's display name. Configure Vite base, manifest ID/start URL/scope, service-worker path/scope, icons, and OCR asset URLs consistently for `/<repository>/`. Support a root-path override for a future custom domain. Use hash navigation for multiple views, or component state for the initial flow, so refreshes never rely on server rewrite rules. See [Vite's Pages guide](https://vite.dev/guide/static-deploy.html).

After deployment, verify HTTPS loading, manifest/icons, camera access, API CORS, OCR assets, and install/offline behavior on a real phone. Publish a build version or commit identifier in app information. To roll back, revert the problematic change on `deploy` and push; the same validated pipeline publishes the revert. Confirm the older app version is compatible with database migrations.

## Implementation milestones

| Milestone | Work and deliverables | Exit criteria |
| --- | --- | --- |
| 1 Data and recognition feasibility | Verify raw/PSA feeds, direct eBay sold-data access, free quotas, schema, CORS, and usage rules; benchmark local OCR | Exact raw/PSA mapping, permitted free data access, and recognition results support the architecture |
| 2 App foundation | Scaffold React/TS/Vite, responsive scanner shell, typed domain models, provider adapter, database, manual lookup | Lookup can identify a card and display validated details with honest unavailable/error states |
| 3 Price display | Raw/PSA 9/PSA 10 rows, pricing proxy, variant/grade mapping, source/date labels, sold-search links, cache/refresh rules | Correct references selected; grade/printing isolation and quota/error handling pass |
| 4 Camera scanning | Camera lifecycle, upload/review/crop, OCR worker, ranking, correction, printing confirmation | Full camera/upload-to-details flow works; cancellation/retake releases resources |
| 5 PWA and deployment | Manifest/icons, local OCR assets, cached shell, update prompt, CI, Pages and proxy deploy workflows | Repository subpath works; push to `deploy` validates and publishes both components |
| 6 Release validation | Phone tests, benchmark evaluation, pricing comparison, accessibility/error checks, setup/release docs | Release checklist below passes; limitations are visible and documented |

Milestone 1 precedes commitments to expensive image matching or a full-catalog download. Milestones 2 and 3 establish trustworthy manual identification/pricing before wiring the scanner into the same flow. No timeline is promised until feasibility and target-device measurements are available.

## Validation and proposed release targets

Use a frozen benchmark of at least 100 labeled captures across at least 50 distinct cards, separated into development and held-out evaluation sets by card identity so photos of the same card do not leak across sets. Include modern/vintage layouts, promos, trainers/energy, sleeves, glare, rotated photos, duplicate artwork, and unsupported cards. Label exact identity and printing separately. Report results by category as well as aggregate; targets below are goals, not measured results.

- Correct card appears within the top three candidates for at least 95 percent of readable held-out captures within supported scope.
- No confidently suggested wrong identity in the release benchmark; ambiguous inputs ask for confirmation. Report held-out counts rather than implying universal zero-error performance.
- Printing remains user-confirmed; no price appears for an unconfirmed ambiguous edition or printing.
- Proposed warm capture-to-candidates target: median below 5 seconds and 95th percentile below 10 seconds on the selected reference phones. Measure initial model download/startup separately. If slower, show useful progress and reassess scope.
- Every displayed price includes metric, currency, selected printing, marketplace/provider, and available source time. All 30 price comparison cases have an explained outcome and no unresolved mapping errors.
- Photos never leave the device, verified through network inspection during camera and upload flows.

Automated tests should cover the risks rather than mirror UI implementation: OCR number normalization, ambiguous matching, repeated artwork, promo identifiers, runtime schema changes, variant mapping, missing/null/zero prices, timestamp handling, cache isolation and migration, cancellation races, offline lookup, denied camera permission, and an installed-app update. Add PSA grade/company isolation, sparse sales, proxy quotas, and partial pricing failures. Browser tests can use a fake camera or uploaded fixture; real iPhone testing is required for camera behavior, installation, and performance. Validate desktop Chrome and Edge capture/upload flows; Android is outside the required MVP matrix.

## Release checklist

- English raw-card scanning and USD references implemented on iPhone and desktop Chrome/Edge.
- Exact PSA 9 and PSA 10 comparison quotes validated through a permitted free source. Search links alone do not satisfy the requested in-app prices.
- Provider usage/attribution reviewed, documented, and compatible with public distribution.
- Benchmark goals evaluated and limitations stated; scans can always be corrected manually.
- Printing/edition pricing verified; no condition-specific valuation claims without corresponding data.
- API outage/rate-limit, missing price, offline, unreadable image, camera denial, and storage failures tested.
- PWA installs and launches on reference phones; cached shell works offline; OCR readiness is accurately shown.
- Production repository subpath works for all JS, images, manifest, worker, WASM, and language assets.
- A push to `deploy` successfully publishes; a failing validation run does not replace the published site.
- App information includes source attribution, privacy summary, build version, and MIT source licensing; third-party assets retain their separate licenses.
- README explains development, validation, deployment setup, release branch usage, and rollback.

## Decisions still needed

Languages, USD, raw scanning, PSA comparisons, single-card capture, online lookup, and target browsers are confirmed. Free operation with a small pricing proxy is also confirmed. The final GitHub repository owner/name is needed to activate hosting, and the reference iPhone model is needed for performance measurements. Provider credentials and a permitted free PSA integration remain required before activation.

## PSA pricing and eBay sold comparisons

Recent sold listings are the preferred evidence for graded comparisons. Match English language, set, collector number, printing, edition, grading company PSA, and grade exactly. Exclude bundles, raw cards, other graders, misleading titles, and wrong editions. Keep shipping treatment consistent and distinguish sale dates from provider refresh dates.

Add separate View PSA 9 sold listings and View PSA 10 sold listings actions. Generate URL-encoded eBay searches from the confirmed identity, using Sold and Completed filters and recent-ending sort. These links open eBay for manual inspection; their search results can still contain irrelevant items and are not an automated in-app valuation.

eBay's [Product Research documentation](https://www.ebay.com/help/selling/selling-tools/product-research?id=4853) distinguishes ordinary recent completed-listing results from Product Research, which provides actual accepted Best Offer amounts. Do not assume the price shown on a public sold page is the accepted offer amount. Exclude unknown transaction amounts from an automated estimate. Seller Hub access does not by itself supply a public API for the app.

Evaluate direct eBay sold-data API availability first, then a provider supplying explicit PSA sold-price data. The [Browse API](https://developer.ebay.com/develop/api/buy) is a listing-search interface, not an established all-market sold-transaction feed. eBay's [decommission table](https://developer.ebay.com/develop/get-started/api-deprecation-status) lists the older Finding API as decommissioned February 4, 2025, so historical completed-search tutorials are unsuitable. A proxy solves credential protection, not sold-data access.

[PokemonPriceTracker](https://www.pokemonpricetracker.com/psa-pokemon-card-api) is a candidate: it exposes `ebay.salesByGrade.psa9` and `psa10`, sales counts, medians, and last-sale dates. Its free tier lists 100 credits/day; the graded lookup example costs two credits per card. Its [terms](https://www.pokemonpricetracker.com/terms) permit free non-revenue-generating apps and caching within the application's own systems, while prohibiting a substitute public data feed. Verify the exact-card/printing mapping, sales windows, accepted-offer treatment, and allowed proxy response before selecting it. No account or key is available yet; this is not an activated integration.

[PriceCharting](https://www.pricecharting.com/api-documentation) is not the free baseline: API access requires payment and third-party app distribution requires express permission. Its grade-9 API field is generic across grading companies, so it cannot automatically be labeled PSA 9.

Use a separate PSA sales-reference metric, preferably a validated sold-price median with sample size and time window. Never label this TCGplayer Market Price. Prefer the latest 90-day window when supported; disclose a broader window for sparse sales. With fewer than three verified sales, label the estimate limited data and show the count; with no verified data, show unavailable. Unknown sales windows or missing counts must be labeled explicitly. Do not derive PSA prices by multiplying raw prices or mixing grading companies.

Proposed infrastructure: a Cloudflare Worker on its free plan, with server-side secrets and only validated exact-card pricing routes. Return minimal normalized comparison data to Goozpokemon rather than a general provider-data API. The browser sends public card IDs and confirmed printing only; no photographs, OCR text, or personal collection data. The [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and provider quota must both fit expected MVP usage.

Cache permitted quotes, rate-limit requests, deduplicate refreshes, and enforce a global provider-credit budget using a free-tier-compatible durable store or equivalent atomic accounting. Do not rely only on an edge-local cache or CORS to protect quota. At the budget limit, return cached/stale or unavailable data and retain eBay inspection links; never upgrade automatically or incur paid usage. Verify a provider request's credit cost before reserving budget. Keep credential values out of logs, source, build assets, and GitHub Pages.

Extend the `deploy` workflow with a validated proxy deployment job after checks, using restricted CI credentials. Publish the Pages build only after any required proxy release succeeds. Preserve backward-compatible proxy responses because installed PWAs may run older clients. CI uses mocked PSA data and must not consume the daily live-data budget. One-time setup adds the serverless account, provider account, and secret configuration; app users still need no sign-in.

Milestone 1 now includes direct eBay/API access investigation, PSA provider feasibility, and free quota/storage validation. Milestone 3 implements the three price rows and proxy. Milestone 5 deploys both components automatically from `deploy`. Before release, compare at least ten exact PSA 9 and ten exact PSA 10 card/printing pairs, including low-volume cards, and explain all mapping or price discrepancies. If no permitted free source meets these requirements, report that gap rather than silently replacing in-app prices with search links.

If condition-specific prices are essential to the first release, obtaining an appropriate permitted feed becomes a feasibility gate. A generic market reference must not be presented as meeting that requirement.
