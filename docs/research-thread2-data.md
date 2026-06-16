# Research Thread 2 — Data Calibration Audit (trailers.json)

**Date:** 2026-06-15
**Scope:** Verify all 59 floorplan records in `src/data/trailers.json` against official Airstream sources (airstream.com primary; official press/spec material and Airstream dealer spec sheets secondary).
**Rule:** Only verified discrepancies with a working source URL are listed. Research only — `trailers.json` was NOT modified.

---

## Headline findings

1. **Physical/dimensional spec data is excellent.** Every checked record's `lengthFt`, `weightLb` (UBW), `gvwrLb`, `hitchWeightLb`, `cccLb` (NCC), `freshGal`, `grayGal`, `blackGal`, and `sleeps` matches Airstream's currently published figures. I found **zero** confirmed errors in these fields across all 12 models / 32 unique floorplans.

2. **Internal consistency is clean.** For all 59 rows, `cccLb == gvwrLb − weightLb` exactly (Airstream's own definition: NCC = GVWR − UBW). Every hitch weight sits in a plausible 8–18% of UBW range. No internally inconsistent rows.

3. **The one real, systemic discrepancy class is the 2026 MSRPs.** Airstream publishes a **single current "Starting at" price per floorplan** (the current/2026 model year), not separate 2025 vs 2026 prices. The repo's **2025** `msrp` values match airstream.com's current "Starting at" prices on the nose. The repo's **2026** `msrp` values are a different set of numbers that do **not** match any published Airstream figure — they appear to be invented/escalated placeholders. 14 of the 31 2026 rows differ from the official current price; the other 17 happen to still match. **Airstream does not publish a distinct "2026 model-year MSRP" that differs from its current starting price**, so every 2026 `msrp` that differs from the current airstream.com starting price is unverifiable/likely wrong.

4. **Coverage is current and complete for mainstream + the three 2026 special editions.** No discontinued lines are listed. Two genuinely current Airstream travel-trailer products are **missing**: the **REI Co-op Special Edition Basecamp 20X** and the **Pottery Barn Special Edition** travel trailer (both are live on airstream.com's lineup nav). See Coverage section.

---

## DISCREPANCY TABLE (verified, with sources)

All MSRP discrepancies below are 2026 rows whose `msrp` does not match Airstream's current published "Starting at" price for that floorplan. (2025 rows for these same floorplans are correct.)

| Model | Floorplan | Field | Current value (repo) | Correct value (official) | Source URL |
|---|---|---|---|---|---|
| Bambi | 16RB (2026) | msrp | 70000 | 68,900 | https://www.airstream.com/travel-trailers/bambi/ |
| Basecamp | 16X (2026) | msrp | 54900 | 55,900 | https://www.airstream.com/travel-trailers/basecamp/ |
| Basecamp | 20X (2026) | msrp | 69000 | 65,900 | https://www.airstream.com/travel-trailers/basecamp/ |
| Basecamp XE | 20 (2026) | msrp | 82651 | 84,900 | https://www.airstream.com/travel-trailers/basecamp-xe/floor-plans/ |
| Caravel | 20FB (2026) | msrp | 85000 | 90,400 | https://www.airstream.com/travel-trailers/caravel/ |
| Classic | 28RB (2026) | msrp | 186800 | 190,400 | https://www.airstream.com/travel-trailers/classic/ |
| Flying Cloud | 27FB (2026) | msrp | 133100 | 127,400 | https://www.airstream.com/travel-trailers/flying-cloud/ |
| Flying Cloud | 30FB Bunk (2026) | msrp | 137850 | 137,400 | https://www.airstream.com/travel-trailers/flying-cloud/ |
| International | 23FB (2026) | msrp | 118000 | 121,400 | https://www.airstream.com/travel-trailers/international/ |
| International | 25FB (2026) | msrp | 135000 | 133,900 | https://www.airstream.com/travel-trailers/international/ |
| International | 27FB (2026) | msrp | 153645 | 142,400 | https://www.airstream.com/travel-trailers/international/ |
| International | 28RB (2026) | msrp | 145000 | 142,400 | https://www.airstream.com/travel-trailers/international/ |
| International | 30RB (2026) | msrp | 160000 | 149,900 | https://www.airstream.com/travel-trailers/international/ |
| World Traveler | 22RB (2026) | msrp | 68300 | 69,400 | https://www.airstream.com/travel-trailers/world-traveler/floor-plans/ |

**Note on World Traveler MSRP:** sources disagree even within Airstream-adjacent material. airstream.com's World Traveler floor-plans page currently shows **"Starting at $69,400"** (also corroborated by New Atlas reporting Airstream's base price of $69,400). However, the original launch coverage and airstream.com's own product page earlier cited **$68,300** (still echoed by The Manual and rvtravel.com). The repo's 68300 was a correct launch price but appears to have been superseded by 69,400. Flag as "price moved," not a hard error. Dealer MSRP (~$78,150) is a separate, higher figure that includes freight/options and should not be used.

### Fields with NO discrepancies found
Across every model, the following all checked out against official sources and need no change:
- **Bambi** (16RB/20FB/22FB): length, UBW, GVWR, hitch, NCC, tanks, sleeps all match airstream.com. (Note: an older cached dealer page showed 16RB NCC=450; airstream.com's current spec block confirms **350**, matching the repo.)
- **Basecamp** (16X/20X) and **Basecamp XE** (20): all physical specs match airstream.com (Basecamp 16X NCC 800, 20X NCC 800, XE NCC 750, hitch 506, UBW 3,750, GVWR 4,500).
- **Caravel** (16RB/20FB/22FB): all match airstream.com (incl. NCC 850/900/950, hitch 520/650/525).
- **Classic** (28RB/30RB/33FB): all match airstream.com exactly (incl. NCC 1,150/2,275/1,575, hitch 875/830/1,150).
- **Flying Cloud** (23FB/25FB/27FB/28RB/30FB Bunk): all match airstream.com exactly.
- **Globetrotter** (25FB/27FB/30RB): all match airstream.com / current dealer data (UBW 5,975/6,300/6,925; hitch 880/875/950; NCC 1,325/1,300/1,875; tanks correct).
- **International** (23FB/25FB/27FB/28RB/30RB): all physical specs match airstream.com (only MSRPs off, above).
- **Trade Wind** (23FB/25FB/27FB): all match airstream.com exactly.
- **Frank Lloyd Wright Limited Edition** (28RB): GVWR 7,600, UBW 6,800, NCC/payload 800, fresh 37, MSRP $184,900 — all confirmed by Airstream press + airstream.com.
- **Stetson 6666 Special Edition** (27FB): length 28'2", UBW 6,700, GVWR 7,600, hitch 900, NCC/cargo 900, tanks 39/39/39, sleeps 4, MSRP $171,900 — all confirmed (airstream.com floor-plan page lists "Starting at $171,900"; note some launch press said $169,900, but airstream.com's current page says 171,900, which the repo matches).
- **World Traveler** (22RB): length 22'2", GVWR 4,500, fresh 19, gray 24, black 12 — all confirmed. Only the MSRP moved (see note).

---

## 2026 model-year coverage check

- **Year split:** 28 records tagged 2025, 31 tagged 2026. Mainstream models (Bambi, Basecamp, Basecamp XE, Caravel, Classic, Flying Cloud, Globetrotter, International, Trade Wind) each have a 2025 + 2026 pair per floorplan — fine.
- **2026-only models present:** Frank Lloyd Wright Limited Edition, Stetson 6666 Special Edition, World Traveler — correctly modeled as 2026-only (all launched for MY2026). Good.
- **No discontinued lines listed.** All 12 modeled families are still in Airstream's current lineup.

### Missing current products (coverage gaps)
These are live on airstream.com's travel-trailer lineup but absent from trailers.json:

1. **REI Co-op Special Edition Basecamp 20X** — current special edition (shown in airstream.com lineup nav "More to Explore"). Source: https://www.airstream.com/travel-trailers/basecamp/ (lineup nav) — confirm exact specs on its dedicated page before adding.
2. **Pottery Barn Special Edition Travel Trailer** — current collaboration edition (shown in airstream.com lineup nav). Source: airstream.com lineup nav. Confirm specs on its dedicated page before adding.

If the site's intent is "mainstream lineup + headline 2026 collaborations," these two are reasonable to add for completeness (they're the same tier as the Stetson 6666 and FLW editions already included). Not errors, just gaps.

### Spec revisions worth noting (not errors)
- No 2026 dimensional/weight revisions were found vs the 2025 figures for any carryover model — Airstream lists one current spec set per floorplan and the repo's values match it for both year rows. So duplicating 2025 specs into 2026 rows is accurate **except for price** (see MSRP discrepancies).

---

## Methodology / caveats
- Primary source throughout was airstream.com model overview + floor-plan pages, which render a "Starting at" price and a Unit Base Weight / GVWR / NCC / Hitch Weight block per floorplan. These are the authoritative current figures.
- airstream.com's live `/specifications/` comparison tables are JavaScript-rendered and did not return tabular data via static fetch; the figures were instead read from airstream.com's server-rendered overview/floor-plan blocks and cross-checked against multiple franchised Airstream dealer spec sheets (Woodland, Bill Thomas, Blue Compass, etc.).
- Airstream publishes **one** current price per floorplan, not separate 2025/2026 MSRPs. Treat any 2026 `msrp` that differs from the current "Starting at" price as unverifiable. The cleanest fix is to set each 2026 `msrp` equal to the current airstream.com starting price (which already equals the repo's 2025 value for that floorplan).
- Where a number could not be independently confirmed on an official source, it is NOT asserted as wrong; all "no discrepancy" entries above reflect positive confirmation.
