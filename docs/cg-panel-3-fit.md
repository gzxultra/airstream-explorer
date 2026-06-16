# Campground Panel — Expert Agent 3: Airstream-Specific Fit & Boondocking Intelligence

**Lens:** "THIS exact Airstream at THIS exact campground." The fusion layer that no
generic camping site (Campendium, The Dyrt, RV Life) can match, because they don't
know your rig's tanks, battery, solar, length, and tow setup — we do, per floorplan.

**Author:** Expert Agent 3 of 5. Research only — no code/data changes made.
**Date:** 2026-06-15

---

## 0. What we actually have vs. what's missing (ground truth)

I inspected `estimate.mjs`, `tow.mjs`, `campgrounds.mjs`, `trailers.json`,
`campgrounds.json`, the collector `scripts/campdata/collect.mjs`, AND I probed the
live Recreation.gov API to learn exactly which fields exist upstream but are
currently discarded. This is the single most important section for the other agents.

### 0.1 Trailer specs (per floorplan, 59 rows) — RICH, already baked
`lengthFt, weightLb, gvwrLb, hitchWeightLb, cccLb, freshGal, grayGal, blackGal,
batteryKwh, solarW, solarStandard, sleeps`. Everything the fusion features need on
the rig side already exists. (Note: some compact models, e.g. Bambi 16RB, have
`grayGal: null` because gray+black is one combined tank — `estimateOffGrid` already
handles null tanks by treating them as Infinity, so guard for it.)

### 0.2 Campground data we have baked TODAY (`campgrounds.json`, 2,561 rows)
`id, name, parent, org, state, city, lat, lon, rating, reviews, price,
reservable, maxLengthFt, equipment[], activities[], photo, sites, url`.

Coverage I measured:
- `lat`/`lon`: **100%** (2561/2561) — the key that unlocks elevation + per-location PSH
- `maxLengthFt`: **88%** (2256/2561) — BUT see the accuracy trap in 0.4
- `rating`: 95%, `price`: 96%, `sites`/`reviews`/`reservable`: 100%
- `equipment[]`: a list of allowed *types* (Tent/RV/Trailer/Fifth Wheel/…), NOT hookup level

### 0.3 What is MISSING from the baked data (hand these gaps to Agent 2)
Two fields the fusion features need are **not** in `campgrounds.json** but ARE
obtainable at build time with zero runtime cost:

1. **Hookup level** (none / electric-only / full). NOT a field in the search API.
   It lives in the **per-campsite endpoint** (see 0.4) as `campsite_type`
   ("STANDARD NONELECTRIC", "STANDARD ELECTRIC", "RV ELECTRIC") and as site
   `attributes` ("Electricity Hookup=50", "Water Hookup", "Sewer Hookup").

2. **Elevation (ft)**. NOT in any Recreation.gov field, but trivially derivable
   from lat/lon at build time. I verified two free sources both work through this
   VM's egress and agree on the Grand Canyon rim (~6,970 ft):
   - **USGS EPQS** (US only, authoritative, 1m raster):
     `https://epqs.nationalmap.gov/v1/json?x={lon}&y={lat}&units=Feet&wkid=4326`
     → returns `value: 6967.52` for Mather CG. One call per campground, US-only —
     perfect since the whole dataset is US.
   - **open-elevation** (global, batch, meters): `api.open-elevation.com/api/v1/lookup`
     batches many `lat,lon|lat,lon` in one call → returned 2138 m for the same point.
   Recommendation to Agent 2: bake an `elevationFt` field in `collect.mjs` via a
   one-time USGS EPQS pass (cache to disk so re-runs are cheap). It's static terrain
   data — it never changes, so it can live in the committed JSON forever.

### 0.4 ACCURACY TRAP I uncovered — `maxLengthFt` overstates trailer fit
This is a real data-quality finding the length panel should care about. The search
API's `campsite_max_vehicle_length` (what we bake as `maxLengthFt`) is the **max over
ALL equipment types**, dominated by motorhomes. The per-campsite endpoint shows the
**Trailer-specific** limit is often much shorter:

> **Mather Campground (Grand Canyon), id 232490:** baked `maxLengthFt = 30`.
> Pulling its 357 campsites, the per-site **Trailer** `max_length` is mostly **15 ft**
> (54 of ~150 RV-capable sites cap trailers at 15′; only a handful reach 27–30′).
> RV/Motorhome at the same sites is rated 21 ft. So a 25 ft Flying Cloud that the
> current panel says "Fits comfortably (30′ max)" would in reality be turned away
> from the majority of sites.

The fix is a fusion feature in its own right (Feature 2 below): compute the
**distribution of Trailer-specific max lengths** per campground, not a single
all-equipment max. The endpoint is:
`https://www.recreation.gov/api/camps/campgrounds/{id}/campsites?limit=N`
→ each campsite has `permitted_equipment[]` with `{equipment_name:"Trailer", max_length}`.

This is a heavier collection pass (one request per campground × 2,561), but it is
build-time only, cacheable, and it makes our flagship length feature *more honest*
than every competitor. Flag to Agent 2 as the highest-value (and heaviest) new pull.

### 0.5 Existing math we reuse verbatim (cite, don't reinvent)
- `estimateOffGrid(t, {people, intensity, season, useSolar})` → `{days, limiter,
  limiterDetail, power, water}`. Constants: `BATTERY_USABLE_FRACTION 0.8`,
  `SOLAR_DERATE 0.7`, `PEAK_SUN_HOURS {summer 5.5, shoulder 4.0, winter 2.5}`,
  `LOAD_PRESETS {light 1500, moderate 2800, heavy 5000 Wh/day}`,
  `WATER_PRESETS`, `GRAY_FROM_FRESH 0.8`. AC is explicitly excluded (documented).
- `evaluateTow(...)` in `tow.mjs`: tongue = `TONGUE_PCT_LOADED 0.13` of trailer GVWR;
  checks tow rating / payload / GCWR; grades at `COMFORT_CEILING 0.80`,
  `CAUTION_CEILING 1.00`.

---

## 1. THE FUSION FEATURES (ranked by uniqueness × feasibility)

Ranking key: **U** = uniqueness (can a generic site do it? no = high), **F** =
feasibility with data we have or can bake. Score = honest gut-rank, 1 = ship first.

| # | Feature | U | F | Net rank |
|---|---------|---|---|----------|
| 1 | "Nights here off-grid" — boondocking duration AT this campground | ★★★★★ | ★★★★☆ | **1 (flagship)** |
| 2 | Trailer-true length fit (per-equipment, % of sites) | ★★★★☆ | ★★★☆☆ | **2** |
| 3 | Hookup match: solar must-have vs nice-to-have | ★★★★☆ | ★★★★☆ | **3** |
| 4 | Elevation/grade tow-stress flag for reaching the campground | ★★★★★ | ★★★★☆ | **4** |
| 5 | "Airstream suitability" composite badges (the summary chip row) | ★★★☆☆ | ★★★★★ | **5** |
| 6 | Cold-night power penalty (winter/high-elevation battery derate) | ★★★☆☆ | ★★★☆☆ | 6 (stretch) |

---

### FEATURE 1 — "How many nights here, off-grid" (FLAGSHIP)

**The pitch:** When a campground has **no electric hookups**, the question every
Airstream owner actually has is "how long can I last here before I have to leave or
run a generator?" We already compute that endurance generically with
`estimateOffGrid`. The fusion move is to **localize it to this campground** using its
latitude + the user's chosen season, and to **only show it where it matters** (no
hookups). No generic camping site can answer "your specific 25FB lasts ~4 nights
here in October" — they don't know your tanks or battery.

**Inputs we have:**
- Rig: `batteryKwh, solarW, freshGal, grayGal, blackGal` (baked, per floorplan).
- Campground: `lat`, and a derived **hookup level** (from Feature 3's pull) to decide
  whether to show this at all. `lat` is 100% present.

**Inputs missing → hand to Agent 2:** hookup level (0.3 #1). Until that exists, we can
gate on a weaker signal (see honesty note) but the clean version needs hookup data.

**The computation (build-time, then interactive client mirror):**
1. Refine PSH by latitude instead of the national default. The cited NREL/state data
   shows summer/winter PSH swings strongly with latitude (e.g. summer: AZ ~7.3,
   Chicago ~4.1; winter: AZ ~5.7, Chicago ~1.5). Build a **latitude→PSH lookup**
   (piecewise by ~5° bands × season) baked as a small table, so a Joshua Tree
   campground (lat 34, sunny) gets a higher winter PSH than a Glacier NP one (lat 48).
   Keep the existing `PEAK_SUN_HOURS` as the fallback when lat is unknown (never is —
   100% coverage — but keep the guard).
2. Call `estimateOffGrid(trailer, {people, intensity, season, useSolar:true})` with
   the localized PSH substituted for the season default. Reuse the function as-is;
   the only change is *which* PSH number season maps to, derived from this lat.
3. Display: `formatNights(days)` + the existing `limiter` ("house battery runs down
   first" / "gray tank fills first") — the limiter is the genuinely useful part: it
   tells the owner whether to pack a solar suitcase or a bigger gray tote.

**Interactivity:** a season toggle (summer/shoulder/winter) and people/intensity
sliders, exactly like the off-grid estimator already has. Mirror the localized-PSH
table in the client (it's a tiny static lookup baked into the JSON island) so it
works offline and in China — no runtime calls. **Parity-test** the client lookup
against the server lookup, same as the tow tool's island parity tests.

**Honesty guardrails (non-negotiable for Ernie):**
- Label it an **estimate** and link the off-grid methodology (the documented 0.8 /
  0.7 / PSH / load-preset assumptions). Reuse the existing disclosure copy.
- PSH localization is *seasonal-average* irradiance, not a weather forecast. Say
  "typical clear-season sun for this latitude," never "you will get."
- Only show when hookups are absent. If hookup data is unknown for a campground, show
  the generic estimate but flag "hookups unverified — check Recreation.gov," rather
  than implying this campground forces boondocking.
- Carry forward the AC-excluded caveat verbatim. Nobody boondocks their A/C.

**Why it ranks #1:** maximum uniqueness (rig × place × season), and feasibility is
high because the math already exists and ships tested — the only new dependency is
the hookup gate (Feature 3's pull) and a small PSH-by-latitude table.

---

### FEATURE 2 — Trailer-true length fit ("% of sites that take YOUR length")

**The pitch:** Our length panel is the existing flagship, but §0.4 proves the single
`maxLengthFt` we bake is **systematically optimistic for trailers** because it's the
all-equipment max (motorhome-dominated). Deepen it into the honest version:
"At Mather, only ~6% of sites accept a trailer your length; most cap trailers at 15′."
That's a killer, defensible, competitor-beating insight.

**Inputs we have:** rig `lengthFt`; campground `maxLengthFt` (current, coarse).

**Inputs missing → hand to Agent 2 (heaviest pull, highest payoff):** per-campsite
`permitted_equipment[]` Trailer `max_length` distribution, from
`/api/camps/campgrounds/{id}/campsites`. Bake per campground:
`trailerMaxLengths: [sorted ints]` or a compact histogram, plus a derived
`trailerMaxLengthFt` (the realistic max for a *trailer*, not a motorhome).

**The computation (build-time):**
- For each campground, collect Trailer-equipment `max_length` across all overnight,
  non-deactivated sites. Derive:
  - `trailerMaxLengthFt` = max trailer-specific length (replaces the optimistic coarse value)
  - `pctSitesAcceptingRig(lengthFt)` = share of sites whose trailer cap ≥ rig length
    (+ the existing 3 ft `CLEARANCE` buffer for the "comfortable" band)
- Client/`fitExplain` then reports e.g. "Fits comfortably — ~62% of sites take your
  27′" or "Tight — only 1 of 40 sites is long enough."

**Honesty guardrails:**
- Keep the existing `conf: 'posted' | 'unverified'` honesty flag. Sites with no
  per-equipment length stay `unverified` — never invent a percentage.
- Show the count, not just the percent ("3 of 48 sites"), so a small-N campground
  isn't dressed up as a precise fraction.
- This *lowers* some fits vs. today — that's the point. It's the conservative,
  honest direction Ernie values; frame it as "trailer-specific, not motorhome-max."

**Feasibility caveat:** the per-campsite pull is 2,561 extra requests at build time.
Mitigations for Agent 2: cache responses to disk; run incrementally; it's dev-time
only so latency is irrelevant; and we can ship a **partial** rollout (only campgrounds
where we've pulled site data get the rich fit; others fall back to the coarse value
with the existing unverified flag). Ranks #2 — slightly lower feasibility than #1
purely because of collection weight.

---

### FEATURE 3 — Hookup match: when is solar a must-have vs. nice-to-have?

**The pitch:** Pair the campground's hookup level with the rig's electrical
self-sufficiency to give a one-line power verdict: "Full hookups — solar irrelevant
here," "Electric only — you're fine, no boondocking needed," or "No hookups — your
2.5 kWh battery + 100 W solar gives ~X nights; bring a generator for longer." This is
the connective tissue that makes Feature 1 trigger correctly, and it's a standalone
badge of its own.

**Inputs we have:** rig `batteryKwh, solarW, solarStandard`, plus Feature 1's
endurance output.

**Inputs missing → hand to Agent 2:** hookup level per campground (0.3 #1). The
per-campsite `campsite_type` is the clean signal — I confirmed the vocabulary:
`STANDARD NONELECTRIC` / `RV NONELECTRIC` (= no hookups), `STANDARD ELECTRIC` /
`RV ELECTRIC` / `TENT ONLY ELECTRIC` (= electric), and site `attributes` carry
`Electricity Hookup=30|50`, `Water Hookup`, `Sewer Hookup` for the full-hookup tier.
Recommend baking a single `hookups: 'none' | 'electric' | 'full'` per campground
(majority/most-generous across sites, with a count), plus optional `ampLevel: 30|50`.

**The computation (build-time + trivial client):**
- Map campsite types → hookup tier (none/electric/full).
- Decision table:
  - `full` → "Full hookups — power & water unlimited; solar & tanks irrelevant here."
  - `electric` (30/50A) → "Shore power covers everything but waste/fresh; you won't
    touch your battery." If 30A, note A/C-while-charging caveat lightly.
  - `none` → trigger Feature 1; classify solar as **must-have** if
    `estimateOffGrid` shows power (not water) as the limiter and solar materially
    extends days; **nice-to-have** if water binds first regardless of solar.
- The must-have/nice-to-have logic is pure and already derivable from
  `estimateOffGrid`'s `limiter` field — run it with `useSolar:false` vs `true` and
  compare days. If solar moves the binding constraint, it's a must-have.

**Honesty guardrails:**
- Hookup tier = "most sites" with a count; many campgrounds mix tiers. Never say "this
  campground has full hookups" if only 2 of 100 sites do — say "2 full-hookup sites."
- 30A vs 50A affects whether you can run A/C while charging; mention as a caveat, don't
  compute A/C runtime (we deliberately exclude A/C from the battery model).

**Why #3:** high uniqueness, high feasibility (logic is pure, reuses estimate.mjs),
and it's the enabling dependency for Feature 1. Could even ship #1 and #3 together.

---

### FEATURE 4 — Elevation / grade tow-stress flag for *reaching* the campground

**The pitch:** "Getting THERE" is half the trip. A loaded Airstream behind a
half-ton at 8,000 ft on a mountain grade is a real, underappreciated stressor. We
have lat/lon for every campground and a tow calculator already. Fuse them: flag
high-elevation / steep-access campgrounds and connect to the rig's tow margin.

**Inputs we have:** rig GVWR + the tow-calculator result (`evaluateTow`), campground
lat/lon.

**Inputs missing → hand to Agent 2:**
- `elevationFt` per campground — bake at build time from lat/lon (verified working,
  §0.3 #2). This alone enables the altitude-power note.
- *Optional, richer:* a "mountain access / narrow road" signal. The Recreation.gov
  `notices[]` and `description` fields carry exactly this language — I saw
  "high alpine campground… narrow roads, tight turns" verbatim on Lake Alpine
  campgrounds. Agent 2 could keyword-scan notices for big-rig/grade warnings and bake
  a boolean `accessWarning` + the source sentence. Honest because it quotes the
  land manager, not us.

**The computation:**
- **Altitude power note (grounded):** naturally-aspirated engines lose ~**3% power
  per 1,000 ft** (well-sourced rule of thumb — Garrett/Western Star service lit,
  multiple engineering refs). At a 7,000 ft campground a non-turbo tow vehicle is
  down ~21% power. We don't know the user's exact engine, so frame it as: "This
  campground sits at 7,000 ft. Expect ~20% less engine power on the climb if your tow
  vehicle is naturally aspirated (turbo/diesel rigs compensate)." Tie to the tow
  tool: if their tow margin is already 'tight', a high-elevation grade is the moment
  it bites.
- **Grade/access flag:** surface the quoted notice when present ("land manager warns:
  narrow roads, tight turns, not designed for modern RVs").

**Honesty guardrails:**
- The 3%/1,000 ft figure applies to **naturally aspirated** engines; modern turbo-gas
  (EcoBoost) and diesels largely compensate. State that explicitly — don't apply a
  blanket penalty. We don't track the user's engine, so present it as conditional
  guidance, not a computed number on their specific truck.
- Elevation is the campground point, not the highest pass en route — say so. We can't
  honestly compute the route's max grade from point data. Frame as "destination
  elevation," and only quote access warnings that come from the official notice.
- Never imply danger we can't substantiate. This is an awareness nudge linked to the
  already-honest tow calculator, not a new verdict.

**Why #4:** very high uniqueness (literally nobody does "your rig + this peak"), and
feasibility is good once elevation is baked. The access-warning layer is a cheap,
honest bonus because it quotes the source.

---

### FEATURE 5 — "Airstream suitability" badge row (the summary chip)

**The pitch:** A compact, honest chip row at the top of each campground card / each
detail-page campground entry that fuses the above into 3–4 glanceable badges. NOT a
black-box 0–100 score (that would manufacture false certainty — against Ernie's bar).
Instead, **honest discrete badges**, each click-through to its reasoning.

**Badges (each only shows when we have the data; otherwise it's omitted, not faked):**
- **Length:** `Fits · 62% of sites` / `Tight` / `Too long` (Feature 2; falls back to
  coarse + unverified flag).
- **Power:** `Full hookups` / `Electric` / `Solar recommended` / `~4 nights off-grid`
  (Feature 3 + 1).
- **Access:** `7,000 ft` / `Mountain access` (Feature 4) — only when elevation/notice
  warrants a flag; omitted for low, easy sites.
- **Season:** `Best Jun–Sep` if we can infer an open season (stretch — Recreation.gov
  has seasonal open dates in the facility endpoint; hand to Agent 2 as optional).

**Honesty guardrails:**
- No composite number. Badges are independent, each labeled with its confidence and
  linked to its methodology. Missing data = missing badge, never a guessed one.
- The badge row is a *summary of features 1–4*, so it inherits all their guardrails;
  it adds no new claims.

**Why #5:** lower uniqueness (it's packaging), but highest feasibility and it's the UX
payoff that makes the other four legible at a glance. Ship it last, on top of 1–4.

---

### FEATURE 6 — Cold-night / high-elevation power penalty (STRETCH)

**The pitch:** Boondocking endurance drops in the cold: LiFePO4 BMS units stop
*charging* below ~32°F (solar can't refill the battery on a freezing morning), and
usable capacity sags. High-elevation + winter/shoulder campgrounds are exactly where
people get caught.

**Inputs missing → Agent 2:** a temperature proxy. We have elevation (Feature 4) and
latitude; a rough expected-overnight-low could be modeled, but it's the least certain
input we'd touch. Alternatively bake a simple "freeze-risk" boolean from
elevation+latitude+season bands.

**The computation:** when freeze-risk is on, apply a documented winter derate to the
solar harvest (charging may be blocked some mornings) and warn that lead-acid loses
usable capacity in cold. Reuse `estimateOffGrid` but with a reduced effective PSH and
a note, never a hard number on the user's exact battery chemistry (we don't track it
per row — hence the blended 0.8 fraction already).

**Honesty guardrails:** this is the most assumption-laden feature, so it stays a
*stretch* and ships only with heavy labeling ("cold can block LiFePO4 charging below
freezing; treat winter estimates as optimistic"). If we can't source the temperature
proxy cleanly, **don't ship it** — better no number than a shaky one. Ranked last
deliberately.

---

## 2. Cross-cutting constraints (how all of this stays within the rules)

- **China-robust / zero runtime deps:** every feature computes either at **build time**
  (elevation bake, hookup tier, trailer length distribution, PSH-by-lat table) or
  **client-side from baked JSON islands** (the season/people/intensity interactivity).
  No runtime calls to Recreation.gov, USGS, or elevation APIs — all of that happens in
  `collect.mjs` at dev time and gets committed, identical to the existing philosophy.
- **No commerce/finance:** none of these touch price beyond the existing display.
- **Accuracy / honesty:** every computed value links to a documented methodology
  (off-grid 0.8/0.7/PSH, tow 13%/GCWR, 3%/1000ft altitude). Missing data is shown as
  missing (`unverified` / omitted badge), never invented. Percentages carry their N.
- **TDD + parity:** mirror server math in the client and parity-test it, exactly as the
  tow tool does. New pure functions (PSH-by-lat lookup, hookup classifier,
  trailer-fit distribution, altitude-note formatter) each get unit tests; the client
  island gets a parity test against the server output.

## 3. Concrete data asks for Agent 2 (the dependency list)
1. **`elevationFt`** per campground — USGS EPQS by lat/lon at build time (verified). Easy.
2. **`hookups: 'none'|'electric'|'full'`** (+ optional `ampLevel`, + site count) — from
   per-campsite `campsite_type`/`attributes`. Medium (per-campground endpoint).
3. **`trailerMaxLengthFt` + per-site trailer-length histogram** — from per-campsite
   `permitted_equipment[]`. Heaviest pull (2,561 requests), highest payoff; cache + allow
   partial rollout with the existing `unverified` fallback.
4. *(Optional)* `accessWarning` boolean + quoted source sentence from `notices[]`/`description`.
5. *(Optional/stretch)* open-season dates from the facility endpoint; freeze-risk proxy.

## 4. Sources (for the methodology citations)
- Altitude power loss ~3%/1,000 ft (naturally aspirated): Garrett Advancing Motion via
  automotiveworld.com; Western Star service literature (dtnatechlit.com); engineerfix.com.
- Peak-sun-hours by location/season: NREL-derived state tables (thegreenwatt.com,
  firemountainsolar.com, solarreviews.com) — basis for the PSH-by-latitude refinement.
- Off-grid power/water assumptions: already documented and sourced in `estimate.mjs`.
- Recreation.gov RIDB endpoints (verified live this session):
  search `…/api/search`, facility `…/api/camps/campgrounds/{id}`,
  campsites `…/api/camps/campgrounds/{id}/campsites` (carry `campsite_type`,
  `permitted_equipment[].max_length`, `attributes`, `notices`).
- Elevation: USGS EPQS `epqs.nationalmap.gov/v1/json` (US, authoritative);
  open-elevation.com (global fallback).
