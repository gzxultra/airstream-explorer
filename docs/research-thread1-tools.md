# Research Thread 1 — Premium Interactive Tools

Researcher: parallel thread 1 of 5. Scope: what high-end RV/travel-trailer
reference & tool sites offer, and which premium interactive tools would elevate
Airstream Explorer. Research only — no code/data changes.

## Repo reality check (what we actually have right now)

Verified against the repo before proposing anything:

- **trailers.json (59 floorplans):** every record has `gvwrLb`, `hitchWeightLb`,
  `cccLb`, `weightLb`, `freshGal`, `grayGal`, `blackGal`, `batteryKwh`, `solarW`,
  `lengthFt`, `sleeps`. Strong trailer-side spec coverage.
- **campgrounds.json:** 2561 sites, **all 2561 have lat/lon**, **2256 have
  `maxLengthFt`** (posted rig-length limit), plus `equipment[]`, `activities[]`,
  `reservable`, `price`, `rating`. Source = Recreation.gov (RIDB), public data.
- **A tow matcher ALREADY EXISTS** on the Explore page (`render.mjs` ~L533,
  `explore.mjs`, `app.js`). It is single-input: user types their truck's *max
  tow rating* and we compare it to each trailer's **fully-loaded GVWR** (not dry
  weight). It does NOT yet model payload / tongue-weight-against-truck-payload /
  GCWR — the failure mode the industry says actually catches people.
- **Floorplan display is a STATIC IMAGE** (`render.mjs` ~L402–403:
  `<figure class="floorplan-fig"><img class="floorplan-img" ...>`). There are
  **no hotspots at all in the codebase** — `grep` for hotspot/data-hot/fp-hot in
  src returns nothing. The task brief's "hover-only hotspots break on touch" is
  describing a *planned/aspirational* feature, not existing code. So this is a
  green-field build, which de-risks it (we can build touch-first from day one).
- **The MapLibre map has NO road/topo tiles.** Basemap is a single self-hosted
  `us-states.json` polygon layer (66 KB) + one glyph PBF. There is no routing
  engine, no road network, no tile pyramid. This is the single most important
  constraint for the "trip/route planner" candidate.
- Existing off-grid estimator (`src/lib/estimate.mjs`) already models power vs
  water, picks the binding limit, uses `BATTERY_USABLE_FRACTION 0.8`,
  `SOLAR_DERATE 0.7`, `PEAK_SUN_HOURS {summer 5.5, shoulder 4.0, winter 2.5}`,
  and `WATER_PRESETS`. The tank-duration math the brief asks about in candidate 3
  **already exists** inside this function.

---

## Candidate 1 — Payload / GVWR / GCWR tow-fit upgrade (UPGRADE the existing matcher)

**What it is.** Upgrade the current single-number tow matcher into a real
compliance check across the three numbers the industry agrees actually matter:
(1) truck **payload** vs the trailer's **tongue/hitch weight + hitch hardware +
passengers + cargo**, (2) **GCWR** vs combined loaded weight, and (3) **tow
rating** vs trailer GVWR (what we already do). The premium insight every
authoritative source repeats: a half-ton truck rated to "tow 11,000 lb" often
runs out of **payload** long before tow rating because tongue weight (10–15% of
loaded trailer) eats the door-jamb payload sticker first. KamperHub, Camping
World, Jalopnik, and the open-source `towcalculator` all frame the check this
exact way.

**Why it's premium.** It corrects the most common and most dangerous RV-buyer
mistake, and it's editorially honest in a way commerce sites can't be (no
upsell). Pairs perfectly with our existing per-floorplan GVWR callout.

**Input data needed & do we have it?**
- Trailer side — **WE HAVE IT.** `gvwrLb`, `hitchWeightLb` (real Airstream tongue
  weight), `cccLb`, `weightLb` are all in trailers.json for all 59 rows. Tongue %
  is derivable.
- Tow-vehicle side — **WE DO NOT HAVE A TRUCK DB**, and acquiring an accurate,
  trim-level payload/GCWR dataset is the hard part. **Key finding: NHTSA's free
  vPIC API returns GVWR but NOT payload, tow rating, or GCWR** — it's a
  VIN/compliance decoder (Make/Model/Year/GVWR/fuel), not a towing-spec database.
  So a VIN→payload lookup is **not feasible** from free public data.
  - **Concrete, China-safe, no-runtime-dep path:** do NOT call any API at
    runtime. Instead keep the tool **user-entry first** (user types payload + tow
    rating + GCWR straight off their door jamb / owner's manual — the numbers the
    sources tell them to use anyway), with a small **curated, hand-built JSON of
    representative tow vehicles** (e.g. ~20–40 common trucks/SUVs by
    class+trim+drivetrain) baked into the repo as quick-set presets, each value
    cited to the manufacturer towing guide. This stays fully static/offline,
    avoids the impossible "accurate every-trim DB" problem, and matches how our
    existing `data-tow` presets (SUV 3500 / half-ton 7700 / ¾-ton 10000) already
    work — just expanded to carry payload + GCWR too.

**Citations (real):**
- KamperHub Towing Weight Calculator (GVWR/GCWR/tongue framing): https://kamperhub.com/us/towing-weight-calculator
- Camping World RV Towing Guide & Capacity Calculator: https://rv.campingworld.com/towguide
- Jayco — Understanding RV Weights (GCWR/UVW/GVWR definitions): https://www.jayco.com/blog/understanding-rv-weights-and-their-meanings/
- iamabrom/towcalculator (open-source; "Truck Available Payload / RV Available Payload / GCVW Available" model): https://github.com/iamabrom/towcalculator
- NHTSA vPIC (proves GVWR-yes / payload-tow-no): https://vpic.nhtsa.dot.gov/

---

## Candidate 2 — Make the off-grid/solar estimator feel premium (ENHANCE existing)

**What it is.** Layer three "pro solar planner" features onto the estimator we
already ship: (a) a **battery-chemistry toggle** (LiFePO4 ~90% usable DoD vs
lead-acid/AGM ~50%) replacing the single blended 0.8 fraction — `estimate.mjs`
already documents this exact tradeoff in a code comment, so it's a natural
surface; (b) **location-aware Peak Sun Hours** instead of a flat seasonal
constant — tie PSH to a state/region the user picks (or, premium move, to the
lat/lon of a campground they've selected from our 2561-site dataset); (c) an
explicit **AC-runtime caveat panel** that says in plain numbers why rooftop AC
isn't in the budget (a single AC ≈ 3,300 Wh in ~3 h), which the estimator
already excludes but doesn't yet *explain* visually.

**Why it's premium.** Turns a single number into a transparent, tunable model —
the thing that separates a real solar planner from a toy. Every assumption is
already sourced in our code; we'd just expose the dials.

**Input data needed & do we have it?**
- Battery chemistry per row — **PARTIAL/NO.** We have `batteryKwh` but not
  chemistry per trailer. Fix: make chemistry a **user toggle** (not per-row), with
  honest defaults; or where Airstream publishes Battle Born/lithium as standard,
  annotate. Toggle approach is the clean, accurate one.
- PSH by location — **WE CAN GET IT STATICALLY.** Bake a small **state→PSH (and
  seasonal) lookup table** into the repo from NREL PVWatts-derived public figures
  (e.g. AZ ~6.5, national avg ~5.0, AK ~3.2). No runtime API, GFW-safe. Can be
  keyed off the campground's `state` (we have it for every site) for the
  "estimate at *this* campground" premium variant.
- AC numbers — **WE EFFECTIVELY HAVE THE MATH** (load presets in Wh/day already
  exist); just add a labeled caveat using documented per-hour AC draw.

**Citations (real):**
- Renogy — Average Peak Sun Hours by State (per-state PSH table): https://www.renogy.com/blogs/general-solar/what-are-the-average-peak-sun-hours-by-state
- The Green Watt — Avg Peak Sun Hours by State (2026 NREL PVWatts v8 data): https://thegreenwatt.com/average-peak-sun-hours-by-state/
- (In-repo) `src/lib/estimate.mjs` constant comments already cite BlackSeries / NREL PVWatts / Off-Road.com for LOAD_PRESETS, PSH, derate, DoD.

---

## Candidate 3 — Standalone fresh/grey/black tank duration estimator

**What it is.** A "how long until a tank ends your trip" tool: people + usage
intensity → days of fresh water, days until gray fills, days until black fills,
and which one binds first.

**Why it's premium-ish (but redundant).** Genuinely useful, BUT the water math
**already exists and already runs** inside `estimateOffGrid()` — it computes
`freshDays`, `grayDays`, `blackDays`, picks `binds`, and surfaces it as part of
the off-grid result. A separate standalone tool would duplicate logic the
endurance estimator already shows. Verdict: **fold it in, don't build it
separately.** The one premium addition worth making: expose the per-tank
breakdown more explicitly *inside* the existing estimator (a little
fresh/gray/black bar showing which fills first), rather than a new page.

**Input data & do we have it?** **YES, fully** — `freshGal`, `grayGal`,
`blackGal` on every row; `WATER_PRESETS` + `GRAY_FROM_FRESH` already coded.

**Citations (real):**
- (In-repo) `src/lib/estimate.mjs` WATER_PRESETS / GRAY_FROM_FRESH already cite RV water-management guidance.
- Camping World RV Towing/weights guide (fresh water = 8.34 lb/gal, tank weight context): https://rv.campingworld.com/towguide

---

## Candidate 4 — Touch-safe interactive floorplan hotspots (BUILD NEW, green-field)

**What it is.** Turn the static floorplan `<img>` into an interactive diagram
where labeled zones (galley, wet bath, dinette/bed, storage, tanks) reveal a
spec/blurb on **tap, click, AND keyboard focus** — not hover. Reality check: the
codebase has **no hotspots today**, so we build it touch-first and never inherit
a hover-only bug.

**Why it's premium.** Interactive floorplans are the headline feature of every
high-end real-estate/property tool; doing it *accessibly* (WCAG 1.4.13 compliant)
is the editorial differentiator.

**The correct pattern (well-sourced):**
- Use **real `<button>` hotspots** positioned over an SVG/overlay, toggled by
  **click/tap**, with hover treated as pure enhancement behind
  `@media (hover: hover)` so touch devices never get stuck "sticky hover" state.
- Meet **WCAG 2.1 SC 1.4.13 "Content on Hover or Focus"**: any revealed content
  must be **dismissable, hoverable, and persistent**, and must also appear on
  keyboard focus (SC 2.1.1). This is the authoritative spec to build against.
- No external deps — pure HTML/CSS/JS over our existing self-hosted image. GFW-safe.

**Input data & do we have it?** **PARTIAL.** We have the floorplan images and
rich per-trailer specs, but **we do NOT have hotspot coordinates** (x/y zones per
floorplan). Those must be **authored by hand** per image (59 plans) or per
family (fewer, since plans repeat within a family). Concrete path: define a small
`hotspots.json` keyed by floorplan slug with normalized {x,y,w,h,label,blurb}
rectangles — a content task, not a data-sourcing problem. Start with the few
hero families to prove it, then expand.

**Citations (real):**
- W3C — Understanding WCAG 1.4.13 Content on Hover or Focus (dismissable/hoverable/persistent): https://w3c.github.io/wcag21/understanding/21/content-on-hover-or-focus.html
- WWU — Content on hover/focus must also work on mobile & keyboard: https://marcom.wwu.edu/accessibility/guide/content-hoverfocus-dismissible-hoverable-and-persistent
- BOIA — Hover Actions & Accessibility (keyboard-equivalent, SC 2.1.1): https://www.boia.org/blog/hover-actions-and-accessibility-addressing-a-common-wcag-violation

---

## Candidate 5 — Trip / route planner over the 2561-campground dataset

**What it is.** Plan a multi-stop trip and surface our campgrounds along a
corridor, filtered by the trailer's length against each site's `maxLengthFt`.

**Why it's premium — but the FULL version is infeasible offline.** True RV route
planning (Roadtrippers / RV Trip Wizard) needs an **RV-safe routing engine** that
avoids low bridges / weight / propane restrictions — that requires a road
network, a routing graph, and map tiles. **We have NONE of that:** our MapLibre
basemap is a single US-states polygon with no roads, no tiles, no router. Adding
real routing means either an external routing API (blocked by GFW / violates "no
external runtime deps") or shipping a multi-GB offline tile + OSRM graph (not
viable for a static Pages site). So the literal route planner is **out of scope
under our hard constraints.**

**What IS feasible fully client-side (the premium-but-honest version):**
- **"Big-rig fit" filtering & a corridor proxy, not turn-by-turn.** We already
  have lat/lon for all 2561 sites and `maxLengthFt` for 2256. Feasible offline:
  filter campgrounds to those that fit a chosen trailer's `lengthFt`; let the
  user drop two+ points and draw a **straight-line/great-circle corridor** and
  show campgrounds within N miles of that line (pure math, no router); cluster by
  state for a "trip skeleton." This is a length-aware **trip-skeleton / fit
  finder**, marketed honestly as planning aid, not GPS navigation.
- This reuses our existing map + dataset and ships zero new runtime deps.

**Input data & do we have it?** **YES for the feasible version** (lat/lon +
maxLengthFt + trailer lengthFt). **NO for true routing** (no road graph/tiles,
and getting them violates constraints).

**Citations (real):**
- Roadtrippers — RV route planner (what full RV routing requires: height/weight/length, low-bridge & propane avoidance): https://roadtrippers.com/rv-route-planner/
- Roadtrippers — Best RV trip planners: must-have features (RV-friendly routing + campground detail): https://roadtrippers.com/magazine/best-rv-trip-planners/

---

## RANKING (best premium-per-effort under our constraints)

1. **Candidate 1 — Payload/GCWR tow-fit upgrade.** Highest impact, fixes the #1
   real-world buyer mistake, builds on a tool we already have, trailer data is
   100% in-repo. Only gap (truck specs) is solved cleanly with curated presets +
   user entry — no API, GFW-safe. **Do this first.**
2. **Candidate 2 — Premium solar/off-grid estimator.** Big perceived-quality jump
   for modest effort; chemistry toggle + state-PSH table + AC caveat all sit on
   math we already ship. Static PSH table is GFW-safe. **Do this second.**
3. **Candidate 4 — Touch-safe interactive floorplans.** Strong visual "wow" and a
   clean green-field build (no legacy hover bug). Gated only by hand-authoring
   hotspot coordinates; start with hero families. **Third.**
4. **Candidate 3 — Tank duration.** Worthwhile but **fold into Candidate 2's
   estimator** rather than build standalone (logic already exists). Not its own
   project.

**Not recommended as scoped:** **Candidate 5 (true route planner)** — real
RV-safe routing is infeasible without external tiles/router, which breaks the
China-network / no-external-dep constraint. Only the length-aware
fit-finder/corridor proxy is feasible, and it's lower premium-value than 1/2/4.

### Cross-cutting notes for the build threads
- The existing tow matcher (render.mjs L533, explore.mjs, app.js) is the
  foundation for Candidate 1 — extend, don't replace.
- The water math for Candidate 3 already lives in `estimate.mjs::estimateOffGrid`.
- No new runtime dependencies are needed for ANY recommended candidate — all are
  pure static HTML/CSS/JS + baked JSON, satisfying the GFW constraint.
- NHTSA vPIC is a dead end for payload/tow specs (GVWR only); don't plan around it.
