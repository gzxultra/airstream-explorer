# Airstream Explorer — Premium Features Research & Prioritized Plan

**Date:** 2026-06-15 · **Method:** 5 parallel research threads, cross-checked & reconciled.
**Scope:** evidence-backed plan to add premium/high-end features, calibrate data, and add effective real imagery.

**Hard constraints (non-negotiable, enforced in every recommendation below):**
- NO commerce / buy / checkout / finance / affiliate. Context MSRPs OK; purchase funnels not. ✅
- Data accurate + sourced (real URLs). ✅
- China-network robust — no external runtime deps the GFW blocks (no Google Fonts, no external CDN/JS, no external map tiles). Everything self-hosted/static. ✅
- Premium editorial bar; nothing templated/generic. ✅

Source detail lives in the five `docs/research-thread*.md` files. This doc is the reconciled, ranked plan.

---

## TL;DR — what to do, in order

1. **Fix the branded-image rule violations** (P0 imagery) — several just-regenerated Upgrades cards invented fake brand logos/badges. Highest credibility risk; cheapest to fix.
2. **Correct the 14 invented 2026 MSRPs** — set each to airstream.com's current "Starting at" price. One-line data edits behind a test.
3. **Ship the premium feature set, TDD-first**, in feasibility order: **Tank duration → Tow/GVWR safety calc → Off-grid estimator polish → Touch-safe floorplan hotspots**.
4. **Layer in premium UX** (tabular figures, touch-safety, fluid type scale, cross-doc View Transitions) — mostly small, high-craft diffs.

Every recommendation needs **zero new runtime dependencies**.

---

## Cross-thread reconciliations (where threads corrected each other)

- **"Tow matcher already exists" + "no tow-vehicle data anywhere"** (threads 1 & 5 agree): the existing matcher only checks tow-rating vs GVWR. The real buyer trap — tongue weight eating a half-ton's payload, and GCWR — is unbuilt. Trailer side is 100% in-repo; **the one true data gap is the tow-vehicle table**, which blocks feature A until populated.
- **Route planner is dead as scoped** (threads 1 & 5): true RV-safe routing needs external tiles/router → violates GFW rule. Only a length-aware campground fit-finder (great-circle over our lat/lon + `maxLengthFt`) is feasible, and it's lower value than the top 4. **Deprioritized.**
- **Tank estimator: don't build a separate page** (threads 1 & 5): the fresh/gray/black math already runs inside `estimateOffGrid()`. Extract it into one shared module and surface a "which tank fills first" view — feature C is an *extraction + surfacing*, not new math.
- **Variable font is a prerequisite, not a feature** (thread 4): the `opsz/SOFT/WONK` axes can't be driven today because we ship static Fraunces cuts. Self-hosting variable Fraunces (build-time subset) unlocks the typography ceiling but is the most build work — do it last.
- **Imagery coverage is structurally complete** (thread 3): all 59 floorplans have hero+gallery+diagram and the guardrail passes. The issues are quality/believability/rule-compliance, not missing files.
- **Off-grid math lives twice** (thread 5): authoritative in `estimate.mjs`, hand-duplicated in `app.js`. Any estimator change must add a **client-parity tripwire test** or the client silently drifts.

---

# (a) Ranked premium features

### Build order (feasibility × value): C → A → D → B
All four are pure-function + baked-JSON, zero new runtime deps, China-robust.

---

## ① Feature C — Tank (fresh/grey/black) duration estimator  *(do first — highest feasibility)*

- **What:** a "which tank ends your trip" view — days until fresh runs out / grey fills / black fills, and which binds first, for any floorplan.
- **Why premium:** turns raw gallon specs into the answer boondockers actually want; visual per-tank bars read like an engineered tool, not a spec dump.
- **Data needed + have it?** `freshGal/grayGal/blackGal` on every row ✅. Water math already exists inside `estimateOffGrid()` ✅. **Net-new data: none.**
- **Design notes:** per-tank horizontal bars, muted unit suffixes, honest "combined waste tank" handling for Bambi (null tank → Infinity, never NaN).
- **Sources:** RV water-management guidance cited in `estimate.mjs`; thread 1 doc.
- **TDD outline (write first → `test/tanks.test.mjs`):**
  - New `src/lib/tanks.mjs` (`estimateTanks`, `formatDays`) by **extracting** the water block from `estimateOffGrid` so there's one model.
  - Cases: fresh = gal/(perPerson·people) within `<1e-9` tol; grey = 80% of fresh binds before fresh on Classic; **null tank → Infinity not NaN** (Bambi combined waste); more people / heavier use → fewer days; `formatDays` rounding.
  - **Regression guard:** assert `estimateOffGrid` water output is byte-identical after extraction.
  - 3 render tests: data-attrs present, omit-when-empty (`renderTankTool` returns `''` with no `freshGal`), escapes hostile `specNote`.

---

## ② Feature A — Tow-vehicle / payload & GVWR safety calculator  *(high value; blocked on data)*

- **What:** upgrade the single-input matcher to check the **three limits buyers actually blow**: towing vs GVWR, **payload vs tongue weight + passengers**, and **GCWR**. Each pass/fail + margin, worst-case verdict (`safe|marginal|over`) and which limit `binds`.
- **Why premium:** tongue weight (~10–13% of GVWR) silently eats a half-ton's payload before tow rating is ever the problem — the failure mode generic calculators miss. This is the credibility differentiator.
- **Data needed + have it?** Trailer side 100% in-repo (`gvwrLb`, `hitchWeightLb`, `cccLb` on all 59) ✅. **Truck side: data gap.** Key finding — **NHTSA vPIC returns GVWR but NOT payload/tow/GCWR**, so VIN lookup is impossible. Solve with a **curated `src/data/tow-vehicles.json`** (~10 cross-shopped trucks/SUVs with official `payloadLb/towMaxLb/gcwrLb/curbLb`) + optional user door-jamb entry. GFW-safe, no API.
- **Design notes:** three labeled gauges with margins; "marginal" within 10%; never auto-pass on missing data → return `null`/"unknown".
- **Sources:** https://kamperhub.com/us/towing-weight-calculator · https://rv.campingworld.com/towguide · https://github.com/iamabrom/towcalculator · https://vpic.nhtsa.dot.gov/
- **TDD outline (write first → `test/towing.test.mjs` + `test/tow-vehicles.test.mjs`):**
  - New `src/lib/towing.mjs` `towingVerdict(trailer, vehicle, opts)`.
  - Cases: passes towing but **fails payload** (the trap); HD clears all three; payload uses GVWR−hitch+pax not dry tongue; within 10% → `marginal`; over → `over` with `binds`; **missing vehicle fields → `null` "unknown", never NaN, never auto-"safe"**.
  - `tow-vehicles.json` validator: positive ratings + `https://` source contract, wired into `build.mjs` (build-time throw), mirroring the upgrades validator.

---

## ③ Feature D — Off-grid / solar estimator → premium  *(high value; enhances existing)*

- **What:** (D1) battery-chemistry toggle (LiFePO4 90% vs AGM 50% DoD) instead of the blended 0.8; (D2) location-aware peak-sun-hours keyed to campground state/lat-lon; (D3) explicit AC-runtime caveat ("house battery can't meaningfully run rooftop AC").
- **Why premium:** matches what top solar planners do; ties the estimator to our real campground geography; honest about AC.
- **Data needed + have it?** Math in `estimate.mjs` ✅; campground lat/lon in `campgrounds.json` ✅. **Net-new: a small static state→PSH table** (bake it; GFW-safe).
- **Design notes:** chemistry as a user toggle (we don't track chemistry per row), default preserves legacy 0.8 so existing tests stay green.
- **Sources:** https://www.renogy.com/blogs/general-solar/what-are-the-average-peak-sun-hours-by-state · https://thegreenwatt.com/average-peak-sun-hours-by-state/ · NREL PVWatts.
- **TDD outline (write first):**
  - `DOD_BY_CHEMISTRY={lithium:0.9,agm:0.5}`; `estimateOffGrid({chemistry})` defaults to 0.8 (all existing tests green).
  - `peakSunHours(lat, season)` falling back to season buckets when no lat; tests: lithium 2250 vs AGM 1250 usable Wh; omitting chemistry preserves 2000; PSH falls with latitude in winter, clamped, summer≥winter, no-lat→buckets.
  - **`test/client-parity.test.mjs`** — read `app.js` as text, assert its inline literals equal the `.mjs` constants. Build-failing tripwire against drift.

---

## ④ Feature B — Touch-safe interactive floorplan hotspots  *(medium; greenfield)*

- **What:** tappable hotspots on the floorplan diagram revealing room/feature detail. **Finding: there are zero hotspots in the codebase today** — this is new build, not a hover-bug fix.
- **Why premium:** interactive floorplans are a hallmark of high-end configurators; done accessibly it signals craft.
- **Data needed + have it?** Diagram images + specs in-repo ✅. **Net-new: hand-authored `src/data/floorplan-hotspots.json`** with **percentage** coords (responsive-safe), by slug; start with hero families.
- **Design notes:** real `<button>` overlays (absolutely positioned — **no new `<img>`, so the guardrail never trips**); click/tap toggle + `Escape` + arrow keys + `aria-expanded`; hover only *enhances* behind `@media (hover:hover)`, never the sole affordance (WCAG 1.4.13).
- **Sources:** https://w3c.github.io/wcag21/understanding/21/content-on-hover-or-focus.html · https://www.boia.org/blog/hover-actions-and-accessibility-addressing-a-common-wcag-violation
- **TDD outline (write first → `test/hotspots.test.mjs`):**
  - `src/lib/hotspots.mjs` (`renderHotspots` + `validateHotspots`).
  - Cases: empty-string when none; real `<button aria-expanded>`; coords emit `left:42.5%`/`top:30%` and **no `px`**; escaped labels/notes; validator rejects out-of-range coords, unknown slugs, missing id/label; render test asserts **zero** new `<img>` refs.

---

## Deprioritized / folded
- **Route/trip planner** — needs external tiles/router → GFW violation. Only a client-side length-aware campground fit-finder is feasible; lower value than C/A/D/B. Park it.
- **Standalone tank page** — folded into Feature C (no separate page).

---

# (b) Data corrections (thread 2 — verified against airstream.com)

**Physical specs are excellent: zero errors found.** Across all 12 models / 32 floorplans, every `lengthFt`, `weightLb`, `gvwrLb`, `hitchWeightLb`, `cccLb`, tank capacity, and `sleeps` matches Airstream's current published figures. Internal consistency clean (`cccLb == gvwrLb − weightLb` every row).

**The one systemic issue: the 2026 MSRPs are an invented set.** Airstream publishes ONE current "Starting at" price per floorplan (not separate 2025/2026 prices). The repo's 2025 prices all match exactly; 14 of 31 **2026** prices don't match any published figure. **Fix: set each 2026 `msrp` to the current airstream.com "Starting at" price** (= the repo's 2025 value for that floorplan). Any 2026 price differing from the current starting price is unverifiable.

| Model | Floorplan (2026) | Field | Current (repo) | Correct | Source |
|---|---|---|---|---|---|
| Bambi | 16RB | msrp | 70000 | 68,900 | airstream.com/travel-trailers/bambi/ |
| Basecamp | 16X | msrp | 54900 | 55,900 | airstream.com/travel-trailers/basecamp/ |
| Basecamp | 20X | msrp | 69000 | 65,900 | airstream.com/travel-trailers/basecamp/ |
| Basecamp XE | 20 | msrp | 82651 | 84,900 | airstream.com/travel-trailers/basecamp-xe/floor-plans/ |
| Caravel | 20FB | msrp | 85000 | 90,400 | airstream.com/travel-trailers/caravel/ |
| Classic | 28RB | msrp | 186800 | 190,400 | airstream.com/travel-trailers/classic/ |
| Flying Cloud | 27FB | msrp | 133100 | 127,400 | airstream.com/travel-trailers/flying-cloud/ |
| Flying Cloud | 30FB Bunk | msrp | 137850 | 137,400 | airstream.com/travel-trailers/flying-cloud/ |
| International | 23FB | msrp | 118000 | 121,400 | airstream.com/travel-trailers/international/ |
| International | 25FB | msrp | 135000 | 133,900 | airstream.com/travel-trailers/international/ |
| International | 27FB | msrp | 153645 | 142,400 | airstream.com/travel-trailers/international/ |
| International | 28RB | msrp | 145000 | 142,400 | airstream.com/travel-trailers/international/ |
| International | 30RB | msrp | 160000 | 149,900 | airstream.com/travel-trailers/international/ |
| World Traveler | 22RB | msrp | 68300 | 69,400 | airstream.com/travel-trailers/world-traveler/floor-plans/ |

**Notes:**
- **World Traveler 22RB:** $68,300 was the correct launch price; current page now shows $69,400 (price moved, not a hard error). Dealer MSRP (~$78,150 w/ freight+options) is a separate figure — don't use it.
- **Near-miss (no change):** a cached dealer page showed Bambi 16RB NCC=450, but airstream.com confirms **350** = repo. Correct as-is.

**Coverage gaps:**
- No discontinued lines listed; all 12 families current. Year split (28×2025, 31×2026) and the three 2026 special editions (FLW Ltd, Stetson 6666, World Traveler) modeled correctly.
- **Two live products missing:** **REI Co-op Special Edition Basecamp 20X** and the **Pottery Barn Special Edition** — both in airstream.com's current lineup nav, same tier as the special editions already included. Confirm specs on their dedicated pages before adding.

**Implementation:** wrap the MSRP fix in a data test that pins each 2026 floorplan's `msrp` to its source value, so it can't silently drift again.

---

# (c) Image-addition / correction list (thread 3)

**Inventory (511 files):** heroes 12, gallery 177, floorplans 59, thumbs 59, upgrades 26, community 36 (Wikimedia, attributed), decor 142. Structurally complete; issues are quality/believability/rule-compliance.

### P0 — branded-rule violations (MUST become REAL product photos)
Several just-regenerated Upgrades cards depict **named brands with AI-fabricated logos/faceplates/badges** (garbled fine print is the tell). Clearest rule violations on the site:

1. **`lithium.webp`** — fake "BATTLE BORN"/Victron labels → real Battle Born. https://battlebornbatteries.com/products/100ah-12v-lifepo4-deep-cycle-battery
2. **`inverter.webp`** (+ likely **`dcdc`, `converter`, `shunt`**) — fabricated "Victron MultiPlus-II/Lynx/SmartShunt" → real Victron product photos.
3. **`compost-toilet.webp`** — invented "NATURAL HEAD" → real Nature's Head. https://natureshead.net/resources/ + https://natureshead.net/shop-all/
4. **`levelmate.webp`** — invented "LEVELONE LC-200" → real LevelMate PRO (LogicBlue).
5. **`maxxfan.webp`** — generic fan → real MaxxFan Deluxe (MaxxAir); Commons RV-interior shots are a license-clean fallback.
6. **`hitch.webp`** — fake "WD-1200" badge → real Equal-i-zer photo *or* honest-generic (drop the fake badge).
7. **`softstart.webp`** — invented "SSC-230V" → real Micro-Air EasyStart *or* honest-generic.

> **Self-critique carried forward:** these came from the prior image-regeneration pass — using `reference_source` only for *some* branded items let the model invent logos for the rest. The rule must be: **any named brand → real reference photo; no brand shown → generated-but-believable is fine.** Generic-by-design cards (solar, brake, surge, water filter, LED, mattress, etc.) are fine to keep generated.

### P1 — replace AI-over-stylized heroes with real official shots
- **`classic.webp`** and **`flying-cloud.webp`** are AI/over-stylized (Classic is exactly the "AI golden-hour" the rule warns against) → real official airstream.com model-line heroes. Basecamp + interior galleries already look genuinely official.

### P2 — balance community-photo coverage (license-clean Wikimedia)
- Under-covered modern lines (Basecamp, Globetrotter, Classic = 0 dedicated; Caravel/Flying Cloud/Trade Wind = 1 each; vintage over-represented at 12). Add from https://commons.wikimedia.org/wiki/Category:Airstream (e.g. CC BY-SA Featured Picture `1963 Airstream trailer in Joshua Tree dllu.jpg`), each with full artist/license/licenseUrl/sourceUrl per the existing JSON schema.

### P3 — premium differentiators (generated/data-derived, fully China-robust)
- Floorplan **dimension/room-label overlays** (diagrams currently have none) — pairs perfectly with Feature B hotspots.
- **Comparison silhouettes / side-by-side floorplans** generated from `trailers.json` spec data.
- Optional real décor in-situ photos; real campground photos if that section lacks imagery.

**Licensing:** Commons additions need full attribution. Manufacturer/Airstream photos are copyrighted — pragmatic for an editorial reference site if self-hosted with an "Image: <Brand>" credit, but **confirm project licensing posture; prefer Commons equivalents where they exist. Self-host everything, no external CDN hotlinking.** Re-confirm each image's license at implementation.

---

# (d) Premium UX upgrades (thread 4) — all China-safe, self-hosted

**Prerequisite finding:** we ship **static Fraunces cuts (wght 500/600/700), not the variable font** — so `opsz/SOFT/WONK` aren't drivable today. Unlocking them = self-host variable Fraunces woff2 (build-time download + `pyftsubset`, first-party). Do this last.

Prioritized by value-to-risk:
1. **Tabular + lining figures on every spec value** — `font-variant-numeric: tabular-nums lining-nums`. Missing on `.card-specs dd`, compare matrix, Upgrades price columns. Tiny diff, immediate "engineered catalog" feel. Not on prose.
2. **Touch-safety pass** — gate decorative hover (`.card` lift, image `scale`) behind `@media (hover: hover) and (pointer: fine)`; migrate `:focus`→`:focus-visible`. Fixes a real stuck-hover bug on touch.
3. **Unified fluid type + space scale** as `clamp()` tokens in `:root` (Utopia method, `rem`/zoom-safe) — replaces 4+ one-off hero clamps.
4. **Cross-document View Transitions** — we're a 59-page MPA, the ideal case. `@view-transition{navigation:auto}` = crossfade in ~1 line; shared `view-transition-name` on card image ↔ detail hero = configurator-style card→detail morph. Highest wow-per-line; degrades gracefully.
5. **Scroll-reveal** — once-only rise+fade. Tier A pure-CSS `animation-timeline: view()`; Tier B ~25-line CSP-safe IntersectionObserver (no GSAP/AOS CDN). Both `prefers-reduced-motion`-guarded; default state visible so JS-off loses nothing.
6. **Variable Fraunces → optical sizing per role** (high `opsz` hero h1; low `opsz` on 12–13px eyebrows so they don't get spindly), whisper of SOFT/WONK on masthead only. Highest craft, most build work — last.
7. **Spec-table craft** — muted unit suffixes, grouped subheads, sticky compare header+label column, `scroll-snap` on mobile compare; plus `text-wrap: balance/pretty`, `content-visibility:auto`, global reduced-motion safety net.

**Compliance rule to enforce:** variable Fraunces must be downloaded/subsetted at build time and served via local `@font-face` — never linked to fonts.googleapis.com at runtime (same pattern as existing static cuts).

---

# Engineering gate compliance (thread 5) — applies to every feature

- **Prebuild gate is real:** `prebuild`=`node --test test/`; `npm run build` runs the full suite first and aborts on failure. **Tests ship first** (harness verified green: 174 pass / 0 fail).
- **Image guardrail** scans emitted `<img src>`, skips `http(s)//`/`//`/`data:`, throws if a local `<img>` doesn't resolve. It does **not** scan CSS backgrounds / inline `data:` SVG / positioned overlays — the cheap, guardrail-safe way to add UI (Feature B uses this).
- New data files get a `validateX` wired into `build.mjs` (build-time throw), mirroring the upgrades validator.
- All same-origin, no `fetch`/CDN (China-robust). Honesty guards return `''`/`null`/unknown rather than fabricating.

---

## Inter-thread hand-offs (open items before implementation)
- **Blocking Feature A:** populate `src/data/tow-vehicles.json` — ~10 cross-shopped vehicles with official `payloadLb/towMaxLb/gcwrLb/curbLb` + a manufacturer towing-guide URL each.
- **Feature D2 fidelity (optional):** baked monthly PSH-by-latitude lookup (NREL PVWatts).
- **Imagery P0:** source real product photos for the 7 branded cards before regenerating.
- **Confirm:** project licensing posture for manufacturer/Airstream photos; whether campgrounds UI renders images (flagged by thread 3).

---

*Full per-thread detail: `docs/research-thread1-tools.md`, `research-thread2-data.md`, `research-thread3-imagery.md`, `research-thread4-ux.md`, `research-thread5-tdd.md`.*
