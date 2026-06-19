# Upgrade Research — Shared Brief (2026-06-19)

**Project:** Airstream Explorer — premium enthusiast reference, static site, Cloudflare Pages.
- Live: https://airstream-explorer.pages.dev
- Repo: gzxultra/airstream-explorer · Workdir: ~/workspace/your_files/airstream-explorer
- Baseline commit: 0015704 (audit just finished, 520 tests pass, 97 HTML pages, 38MB dist)

## CURRENT STATE (ground truth — confirmed by lead, do not re-discover)
**Sections / nav:** Explore & match · Motorhomes · Compare · Campsites · Upgrades · Maintenance · Community photos
**Catalog:** 59 trailer floorplans (2025+2026, 31 distinct × year twins) across 12 trailer families + 11 motorhomes across 4 families (Atlas, Interstate-19, Interstate-24, Rangeline). 16 product lines total.
**Shipped client tools (src/assets/js/app.js, 3411 LOC, 172KB):**
  - Tow safety calculator (3-check: tow rating / payload / GCWR; 11 tow vehicles)
  - Payload/packing calculator
  - Off-grid estimator (battery/solar/water endurance)
  - Fuel-cost estimator (towing MPG penalty)
  - Interactive floorplan zones (touch-safe hotspots)
  - Compare page (side-by-side)
  - Saved favorites tray (localStorage)
  - Campsites MapLibre map: self-hosted tiles, basemap switcher, live recreation.gov availability fetch, boondock/dispersed finder, campsite fit logic (length-aware)
  - Collections rail, share-by-URL hash
**Data files (src/data/):** trailers.json (59), motorhomes.json (11), tow-vehicles.json (11), upgrades.json (6 cats), maintenance.json (7 cadences/39 tasks), campgrounds.json (~2500 recreation.gov), boondocking.json, overnight.json, resource-points.json, decor-options.json, community-photos.json
**Lib:** 27 .mjs modules, 7015 LOC. render.mjs (1051), campsites.mjs (584), maintenance.mjs (505).
**Infra SHIPPED (already done — NOT a gap):**
  - functions/cdn/[[path]].js — same-origin image proxy (China-robust, recreation.gov photos)
  - functions/tiles/[[path]].js — self-hosted map tile proxy
  - Self-hosted fonts (Fraunces + DM Sans), self-hosted MapLibre — no Google/external CDN
  - 520 tests (node:test), build-time image guardrail (every <img> resolves on disk)

## HARD CONSTRAINTS (reject any proposal that violates these)
1. **NO commerce/finance/affiliate.** Pure reference. No buy buttons, no purchase-price funnels, no affiliate links. The only "price" allowed = nightly campground fee (reference). Context MSRP display OK; purchase funnel NOT.
2. **Accuracy paramount.** Every spec verifiable vs official Airstream / authoritative sources. No fabrication. Every factual claim needs a live source URL in data.
3. **NO AI-generated imagery for functional/diagram content** — inline SVG only, currentColor strokes. Heroes/gallery = curated REAL photos (Wikimedia Commons) with attribution.
4. **Premium editorial design** (Fraunces + DM Sans, copper-on-cream). Never templated/generic/"too AI".
5. **Static-site friendly** — no server runtime. Cloudflare Pages Functions (edge) OK for proxying; no stateful backend, no DB.
6. **China-robust** — no GFW-blocked runtime deps (no Google Fonts, external CDN/JS, external map tiles).

## KNOWN STALE ITEM (flag, likely quick win)
README.md line 51 + footers in render.mjs:92 & motorhome-render.mjs:64 still say "Some imagery is AI-generated and labeled as such / accordingly." This contradicts the current no-AI-imagery policy (all imagery is now real photos or hand-coded SVG). Disclaimer text is stale and self-undermining for a credibility-first reference site.

## PRIOR RESEARCH (read before proposing — don't repeat settled conclusions)
- docs/round2-summary.md — P0/P1 prioritized plan (image proxy now DONE; check what else shipped vs still open)
- docs/premium-features-research.md — tank estimator, tow calc, off-grid, floorplan hotspots (mostly shipped)
- docs/feature-research-notes.md — fuel + packing calc (shipped)
- docs/research-thread{1-5}.md, docs/cg-panel-{1-5}.md, docs/panel-*.md — deep dives per topic
Many earlier proposals are now SHIPPED. Your job: figure out what's genuinely still open and what's NEW since.
