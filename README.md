# Goozpokemon

A free Pokemon card scanner planned as a local-first progressive web app. No sign-in. Collection cataloging is deferred until identification and pricing are reliable.

Status: research and repository initialization only; application code has not been scaffolded. Research checked October 12, 2026.

The [initial MVP plan](docs/MVP-PLAN.md) defines scanning, card details, market pricing, and automatic GitHub Pages deployment on pushes to the `deploy` branch.

## Proposed technology

| Area | Choice | Purpose |
| --- | --- | --- |
| UI/build | React, TypeScript, Vite | Static client application, with typed card and price models |
| PWA | vite-plugin-pwa / Workbox | Installable manifest and app-shell caching |
| Local storage | IndexedDB through Dexie | Card metadata, price snapshots, settings, and later collection records |
| Camera | getUserMedia and file input | Rear camera capture plus photo-upload fallback |
| Recognition | Canvas preprocessing and Tesseract.js in a Web Worker | Read card name, collector number, and set code on device |
| Data | TCGdex REST API behind a provider interface | Candidate catalog, images, and marketplace pricing without embedded secrets |
| Verification | Vitest and Playwright | Pricing/matching regression checks and browser workflows |

The scanner choice is an experiment, not an accuracy claim. Benchmark OCR against real card photos before committing to it as the final recognition solution. Consider local visual matching if text recognition proves insufficient. Host OCR worker, WASM, and language assets with the app and explicitly cache them for offline recognition.

## Collectr research

Collectr supports camera scanning, suggested matches, correction of matches, variant details, and links to sold listings. Users can continue capturing while earlier scans process. Its broader product includes portfolios, raw/graded/sealed products, watchlists, set progress, price charts, currencies, bulk organization, and social/marketplace features. Unlimited scanning and extended price history are advertised as PRO features.

Sources: [scanner help](https://getcollectr.notion.site/Scanning-for-Products-130f17a424d480f39648e43114688c76), [feature index](https://getcollectr.notion.site/Welcome-to-Collectr-10dfe89061af468aa3a76e669d9f6cbb), [portfolio features](https://www.getcollectr.com/track.html), [PRO](https://www.getcollectr.com/pro.html).

Collectr advertises sales-based daily valuations. These public sources do not establish its complete pricing methodology or prove why a particular price is wrong. The user's reported pricing problems motivate independent verification rather than an assumption about Collectr's implementation.

## Pricing approach

TCGplayer Market Price uses recent completed sales; listed median and low prices measure asking prices and must remain separate. Its app allows printing, language, and condition selection. See [Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price), [price definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean), and [app FAQ](https://help.tcgplayer.com/hc/en-us/articles/115009506407-TCGplayer-App-FAQ).

Recommended first data provider: [TCGdex](https://tcgdex.dev/markets-prices), which documents TCGplayer USD and Cardmarket EUR data embedded in card responses, with printing-specific prices and update timestamps. TCGplayer refreshes are documented as hourly to daily. Coverage, exact product mappings, reuse terms, and price agreement still require verification across representative cards.

A live smoke check of https://api.tcgdex.net/v2/en/cards/swsh3-136 returned HTTP 200, Access-Control-Allow-Origin: *, Furret, and distinct normal/reverse-holofoil USD market prices. The documentation's sample labels that same ID Charizard and uses different variant keys; use live responses and runtime validation rather than copying samples literally. This one check verifies endpoint availability, not valuation accuracy or full coverage.

Provider alternatives and constraints:

- [Direct TCGplayer API](https://docs.tcgplayer.com/docs/getting-started): documentation says new access is closed; requires secret credentials, unsuitable for a public client bundle.
- [Pokemon TCG API](https://docs.pokemontcg.io/getting-started/rate-limits/): currently marked deprecated; new accounts unavailable and existing keys supported through March 1, 2027. Do not use as the new app's foundation.
- [TCGCSV](https://tcgcsv.com/): public daily TCGplayer catalog/pricing snapshots. Possible fallback after mapping and reuse checks; [FAQ](https://tcgcsv.com/faq) says individual sales/listings are unavailable. It would not constitute an independent second marketplace.

Pricing requirements:

1. Match language, set, collector number, printing, and edition; never price by Pokemon name alone.
2. Ask the user to confirm foil/edition and condition when uncertain. Do not infer grading, authenticity, or condition reliably from one photograph.
3. Display marketplace, currency, metric, provider update time, and cache age alongside each price.
4. Treat documented aggregate prices as market references. The proposed public feed does not document condition-specific quotes; never label its aggregate as a selected-condition valuation or apply invented percentage discounts.
5. Show unavailable values as unavailable, not zero. Never silently substitute another printing, region, condition, or price metric.
6. Keep cached prices visible offline with a stale label; current prices require an online refresh.
7. Provide an exact product link for inspection. Validate representative vintage, modern, promo, foil, reverse-foil, and edition variants against marketplace pages before shipping.

## First implementation milestone

Capture or upload one card, crop/deskew, extract text, rank candidate cards, confirm the match/printing, then show card image, name, set, collector number, rarity, and an attributed market reference. Include manual name/number lookup when scanning fails. Do not add portfolios or collection management yet.

First benchmark should measure exact-card match rate, confident wrong matches, foil ambiguity, and capture-to-result latency on target phones. Include sleeves, glare, older layouts, trainer/energy cards, and repeated artwork across sets. Recognition confidence and pricing completeness are separate states.

Personal data and photographs stay on device by default. Public data requests still contact external services. Offline coverage is limited to downloaded catalog/assets and cached prices until a larger download strategy is chosen. Later collection storage will need export/import and persistence handling because browser storage can be cleared.

## Confirmed MVP scope

- English cards, USD, and ungraded card scanning, with separate PSA 9 and PSA 10 comparison prices.
- One card per capture, with internet required for fresh details/prices and photos kept on device.
- iPhone Safari/PWA and desktop Chrome/Edge are the target platforms.
- GitHub Pages frontend, with automatic release on pushes to `deploy`. A small free serverless pricing proxy is allowed; hosting and operation must remain free.
- eBay recent sold comparisons will be investigated for PSA prices, with grade-specific search links for inspection. A permitted automated PSA feed and proxy are still to be selected and activated; see the detailed plan.

Copyright holder remains provisionally Sayed. Raw condition-specific valuation remains a separate provider limitation.

## License

App source: MIT; see [LICENSE](LICENSE). This license does not grant rights to third-party Pokemon artwork, trademarks, or provider data.
