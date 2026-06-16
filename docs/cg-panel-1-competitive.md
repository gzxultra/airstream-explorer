# Campground Upgrade — Panel 1: Competitive Feature Scan

**Expert lens:** Survey the best RV/camping discovery & trip-planning products; extract the
"wow" features and rank what we can honestly adapt to *our* static, China-robust, no-commerce site.

**Our reality (the box every idea must fit in):**
- Data we own (baked at build): 2,561 RV-capable Recreation.gov sites with
  `lat/lon, rating, reviews, price{min,max}, reservable, maxLengthFt, equipment[], activities[], org, parent, state, city, sites, photo, url`.
- Current finder: self-hosted MapLibre + US-states polygon basemap (NO road/topo tiles), rig-length
  filter, state/search/sort list, plus a per-detail "where this fits" panel.
- Hard constraints: **no commerce/affiliate**, **every claim sourced**, **China-network robust**
  (no Google Fonts / external CDN / external tiles / runtime third-party fetch — everything
  self-hosted & baked), premium editorial bar (Fraunces + DM Sans, copper/paper), static Node ESM
  build, TDD, fingerprinted assets, image guardrail, CSP-safe vanilla JS (no eval/innerHTML),
  **no routing engine**.

---

## Competitor teardown (what enthusiasts actually love)

### Campendium — "where RVers go first"
- **Cell coverage overlay per carrier** + cell-signal as a *first-class, commonly-reviewed* field.
  The single most-quoted reason remote workers swear by it ("I rely on cell signal… I know where I
  can actually stay"). Source: https://apps.appfollow.io/ (app listing) and
  https://play.google.com/store/apps/details?id=com.campendium.app
- Free/dispersed camping search across BLM/USFS/NPS; save favorites & fuel stops.
- PRO: **CAMPalerts** (text when a sold-out site opens), Autopilot trip planning, RV-safe GPS,
  offline maps, overlays (cell, public land, wildfire smoke, traffic), GPX/PDF export.
  Source: https://lifestyle.kotaradio.com/ (Campendium RV PRO press release) — note "Offline Maps [coming soon]".

### The Dyrt — largest review community; best *RV trip planner*
- **Drive Time** — "instantly find campsites within a predetermined amount of driving time from
  your current location"; great for weekend trips and discovering near-home spots; explicitly
  solves the "nearby as the crow flies but no direct route" problem. Source:
  https://thedyrt.com/magazine/lifestyle/the-dyrt-drive-time/ (Drive Time launch).
- Trip planner: RV-safe routing & bridge-clearance warnings, drag-and-drop up to 100 waypoints,
  fuel calculator, **trip journal** (notes, dates, reservation/contact info), **export to Google
  Maps in one tap**, dump & water stations on route. Source:
  https://pages.thedyrt.com/ (Trip Planner 2026) and https://en.wikipedia.org/wiki/The_Dyrt
- Free Camping Collection (staff-verified) + state-specific permit info.

### Roadtrippers — discovery of *places worth stopping*
- The killer is **curated, road-trip-specific POIs** that beat Google Maps (scenic byways, quirky
  stops, lesser-known state parks) + **pre-made trip guides / curated itineraries**.
  Source: https://www.techradar.com/ ("a trip planner that puts Google Maps to shame") and
  https://roadtrippers.com/blog/ (multi-state road trip tools).
- Trip collaboration (shared itinerary, one editor), category filters, RV dims-aware routing.

### AllStays Camp & RV — the logistics/safety workhorse
- **70+ stackable, *savable* filters** (hookups, site length, pull-through, pet, propane type…),
  and crucially **road-hazard data: bridge clearance + road grade**, dump/propane/water as
  independent POIs. Has a **Stargazing / dark-sky filter** and **Historical Significance** filter.
  Source: https://travelguide.allstays.com/ (2026 filters update) and
  https://boondockorbust.com/ (AllStays 2026 review).

### iOverlander — community truth, offline-first
- **"Only real places by real travelers… No signal? No problem."** All data stored on-device for
  offline use; color-coded pin taxonomy (overnight parking / campground / wild camp / water /
  dump / services); reviews emphasize flat ground, wind exposure, phone signal, big-rig
  suitability, recency. Source: https://play.google.com/store/apps/details?id=com.ioverlander.v2
  and https://blog.indiecampers.com/ (How to Use iOverlander 2025).

### Recreation.gov / FreeRoam / Hipcamp (supporting)
- Recreation.gov: the authoritative reservation source + availability + alerts (our underlying
  data source; live API is GFW-suspect — see constraints).
- FreeRoam / Gaia: stacked map layers (cell, public/private land, fire activity, elevation,
  motor-vehicle-use) for legal, safe boondocking. Source:
  https://www.outsideonline.com/ (Gaia overland map layers).

---

## What competitors do that we CANNOT honestly ship (flagged)

| Feature | Why it's off-limits here |
|---|---|
| RV-safe routing, bridge-clearance & road-grade warnings (Dyrt, AllStays, Roadtrippers) | Needs a **routing engine + clearance/grade datasets** we don't have and can't run statically/offline. Don't fake turn-by-turn. |
| Live cell-coverage overlay (Campendium, FreeRoam) | Requires **per-carrier coverage tiles / runtime data** — external, heavy, and GFW-fragile. (See "honest substitute" below.) |
| CAMPalerts / live availability ("text when a sold-out site opens") | Needs **runtime recreation.gov API** — GFW-blocked in China and out of scope here (Panel handling the CF proxy owns that thread). |
| Commission-free **booking / Instant Book** (Dyrt) | Violates **no-commerce** constraint outright. |
| Member discounts / affiliate fuel deals (Campendium, Roadtrippers) | **No affiliate/commerce.** |
| Wildfire-smoke / live-traffic overlays | Runtime third-party fetch — not China-robust. |

---

## RANKED shortlist — features adaptable to OUR site

### 1. ⭐ Site-wide "My Rig" profile → fit-filter the whole catalog (HIGHEST LEVERAGE)
- **What:** A persistent rig profile (trailer model length + loaded GVWR, optionally tow vehicle)
  saved client-side (localStorage), that *threads through the whole site*: it pre-fills the
  already-shipped **Tow Safety Calculator** AND becomes the campground finder's fit lens —
  auto-applying `maxLengthFt` filtering and flagging "tight fit" sites for your exact rig.
- **Why it's compelling for Airstream owners specifically:** Every competitor filters by a generic
  "rig length" the user re-enters each time. **We are the only site that already knows the real
  Airstream floorplan dimensions and tow numbers** — so we can connect "can I tow it" → "where can
  I park it" as one continuous story. No app can do this because they don't model specific trailers.
  This is our moat, not a copy.
- **Feasibility:** ✅ Fully client-side, offline, CSP-safe (localStorage + vanilla JS). Length data
  already in `maxLengthFt`; trailer specs already in `trailers.json`. No new data sourcing.
- **Closest competitor:** AllStays savable rig filters — https://travelguide.allstays.com/ — but
  theirs is generic; ours is Airstream-aware.

### 2. ⭐ "Weekend Reach" drive-time discovery (honest haversine isochrone)
- **What:** Pick a home point (or a campground) + a drive-time budget (2h / 4h / 6h / full day) and
  highlight all campgrounds within an **estimated** reach ring on the map + a ranked list.
- **Why compelling:** The Dyrt's **Drive Time** is one of its most-loved PRO features ("unlock every
  camping option within your preferred driving time"). It reframes 2,561 dots into "what's a
  realistic trip for *me this weekend*" — exactly how Airstream owners actually plan.
- **Feasibility:** ✅ but **must be honest**. We have **no routing engine**, so we approximate with
  great-circle (haversine) distance × a conservative average road-speed factor, clearly labeled
  "estimated straight-line reach, not road distance." This is computable in-browser, offline, zero
  external calls. Do NOT imply true ETA. (Real isochrones need a routing API — flagged as off-limits.)
- **Closest competitor:** The Dyrt Drive Time — https://thedyrt.com/magazine/lifestyle/the-dyrt-drive-time/

### 3. ⭐ Dark-Sky / Stargazing discovery layer
- **What:** A curated "Stargazing" lens that surfaces campgrounds whose `activities[]` already
  include **"Star Gazing"**, cross-referenced with **DarkSky International–certified** parks/places
  (list baked at build) so we can badge "Near a certified Dark Sky Place."
- **Why compelling for Airstream owners:** Stargazing is squarely on-brand — aspirational, photogenic,
  premium-editorial, and aligns with the polished-aluminum-under-the-stars Airstream identity.
  AllStays just added a Stargazing filter (https://travelguide.allstays.com/), validating demand.
- **Feasibility:** ✅ Activity tag already present in our data; DarkSky place list is a small static
  dataset we bake at build (source: https://darksky.org/what-we-do/international-dark-sky-places/).
  Every badge sourced. No runtime deps.
- **Closest competitor:** AllStays Stargazing filter — https://travelguide.allstays.com/

### 4. Saved trips / favorites + GPX & printable export
- **What:** Star campgrounds into named lists ("Southwest loop"), reorder them, then **export GPX**
  (loads into any GPS) and a **print-clean PDF/printable itinerary** with coords + official links.
- **Why compelling:** Favorites + GPX/PDF export are table-stakes-beloved across Campendium (export)
  and The Dyrt (trip journal, "export to Google Maps in one tap"). It turns browsing into a plan
  the user keeps.
- **Feasibility:** ✅ Entirely client-side (localStorage + Blob download), offline, no commerce, no
  external calls. GPX is plain XML we generate; printable view is CSS `@media print`.
- **Closest competitor:** Campendium GPX/PDF export — https://lifestyle.kotaradio.com/ ; Dyrt trip
  journal — https://pages.thedyrt.com/

### 5. Managing-agency / public-land lens (color + filter)
- **What:** Color map pins and add a filter by managing agency using our existing `org`/`parent`
  fields (National Park Service / US Forest Service / BLM / Army Corps / State Parks…), with a
  short plain-language note on what each typically means for an RVer (hookups vs. primitive, length
  limits, reservation windows).
- **Why compelling:** Public-land overlays are a staple of FreeRoam/Gaia/Campendium because *land
  type predicts the experience* (full-hookup vs. boondock, crowds, cost). We can deliver the signal
  honestly without any external boundary tiles.
- **Feasibility:** ✅ Derived from data we already have. No new sourcing, no external layers.
- **Closest competitor:** FreeRoam/Gaia public-land layers — https://www.outsideonline.com/

### 6. Curated editorial route guides (scenic byways & park loops)
- **What:** A handful of hand-built, premium editorial "trail" pages (e.g., Pacific Coast, Utah's
  Mighty 5 loop, Blue Ridge) that string together our existing campgrounds along an iconic route,
  with rig-fit and dark-sky callouts. Static, baked content — not live routing.
- **Why compelling:** Roadtrippers' curated guides and The Dyrt's PCH guide are major draws; this is
  the most natural home for our premium Fraunces/copper editorial voice and differentiates us from
  generic dot-on-a-map apps.
- **Feasibility:** ✅ Build-time editorial + links to our own detail pages. No routing engine
  needed (we describe the route narratively and list ordered stops). Each factual claim sourced.
- **Closest competitor:** Roadtrippers guides — https://roadtrippers.com/blog/ ; Dyrt PCH guide —
  https://www.morningstar.com/ (The Dyrt PCH guide press release).

### 7. Elevation & seasonality signal (baked at build)
- **What:** Add an `elevationFt` field per campground (looked up against a DEM at build time) plus a
  derived "likely season" hint (high-elevation sites = late-spring→fall; desert = shoulder seasons),
  shown on detail pages and as a filter.
- **Why compelling:** Campendium/iOverlander offer elevation filters because elevation drives both
  towing grades and whether a site is snowed-in. Useful and honest.
- **Feasibility:** ⚠️ Feasible but needs a **build-time** elevation lookup (e.g., open elevation
  dataset processed offline) — heavier sourcing than #1–6, and seasonality must be hedged as a hint,
  not a guarantee. Lower priority for that reason.
- **Closest competitor:** Campendium elevation filter / Gaia layers — https://www.outsideonline.com/

### 8. "Honest connectivity" note (substitute for live cell overlay)
- **What:** Instead of a live carrier overlay (off-limits), add a static, sourced remoteness signal:
  flag sites far from towns / on remote public land as "expect limited/no cell — plan offline,"
  derived from distance-to-city and managing agency.
- **Why compelling:** Connectivity is the #1 reason remote-working RVers love Campendium; we can give
  the *signal* honestly without faking coverage data.
- **Feasibility:** ✅ Derived heuristic, clearly labeled as an estimate (not a coverage guarantee).
  Must avoid implying carrier-specific accuracy. Medium leverage.
- **Closest competitor:** Campendium cell-coverage reviews — https://play.google.com/store/apps/details?id=com.campendium.app

---

## Top 3 picks + single highest-leverage call

1. **Site-wide "My Rig" profile threading the Tow Calculator into the campground finder.** ✅ Fully
   client-side/offline; reuses data we already own; *no competitor can replicate it* because they
   don't model specific trailers.
2. **"Weekend Reach" drive-time discovery (honest haversine ring, clearly labeled "estimated").** ✅
   In-browser, offline; adapts The Dyrt's most-loved feature without a routing engine.
3. **Dark-Sky / Stargazing layer** badging our existing "Star Gazing" sites against DarkSky-certified
   places. ✅ On-brand for Airstream; small baked dataset, every badge sourced.

**Single highest-leverage feature → the "My Rig" profile.** It's the one thing no RV app can copy
(they sell trips/bookings, not Airstreams), it monetizes work we've *already shipped* (the tow
calculator's vehicle/trailer model), it's 100% offline/China-robust and commerce-free, and it turns
three separate tools into one coherent "can I tow it → where can I take it → is it a fit" narrative —
the most premium, distinctly-Airstream experience on the shortlist.
