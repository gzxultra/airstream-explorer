# Campground Panel — Expert Agent 2: Recreation.gov / RIDB Data Depth

**Lens:** Which additional campground data dimensions matter to Airstream/RV owners
**and** are obtainable + reliably sourceable from Recreation.gov, to bake richer
filters and per-campground detail. **Constraint:** everything fetched/computed at
BUILD time, baked static, zero runtime external deps (China-robust).

---

## TL;DR

The single biggest finding: **we are currently leaving most of the data on the
table.** Our `collect.mjs` only reads the *search* endpoint
(`www.recreation.gov/api/search`), which returns shallow fields. But Recreation.gov
exposes **two richer, no-API-key, public JSON endpoints** that power its own site:

| Endpoint | Auth | What it adds |
|---|---|---|
| `GET /api/camps/campgrounds/{id}` | **none** | facility `amenities` map (Electric Hookups, Dump Station, Drinking Water, Showers, Pets Allowed, Cell Phone Service…), `notices`, `stay_limit`, phone/email, address |
| `GET /api/camps/campgrounds/{id}/campsites` | **none** | per-site `attributes`: `electric_hookup` (30/50 amp), per-site `max_vehicle_length`, `driveway_entry` (Pull-Through vs Back-In), `driveway_surface`, `shade`, `proximity_water`, `is_accessible`, `pets_allowed`, `campsite_type` |

The **key-gated RIDB v1 API** (`ridb.recreation.gov/api/v1`, the "developer docs"
the task pointed at) returns `401 Unauthorized` without a registered key, and its
swagger/api-docs paths 404. We do **not** need it — the two no-key endpoints above
carry the same underlying RIDB data and are what recreation.gov itself calls. They
fit our build-time-bake / no-key philosophy exactly (same pattern `collect.mjs`
already uses with the search endpoint via `curl`).

All three endpoints were live-verified this session (HTTP 200, real payloads).

---

## Endpoint reference (verified)

### 1. Facility detail — `GET /api/camps/campgrounds/{id}`
No key. ~24 KB JSON. Top-level under `.campground`. Relevant fields:

- **`amenities`** — object map of facility amenities, e.g.
  `{"Electric Hookups":"Electric Hookups","Dump Station":..., "Drinking Water":...,
  "Showers":..., "Pets Allowed":..., "Cell Phone Service":..., "Flush Toilets":...,
  "Accessible Campsites":...}`. **This is the richest single addition.** Free-text
  labels (not normalized booleans), but the vocabulary is consistent across
  facilities, so build-time keyword normalization is straightforward.
- `notices` — array of `{notice_type, notice_text}` (warnings, check-in rules).
- `stay_limit` — string, frequently **empty** (low coverage; see Avoid).
- `facility_phone`, `facility_email`, `addresses[]` (Physical + Mailing), `facility_directions`.
- `facility_adaaccess` — **BROKEN. Universally `"N"` even at facilities with
  "Accessible Campsites" amenities. Do NOT use this field.** Derive accessibility
  from the `amenities` "Accessible *" strings instead.

### 2. Campsites — `GET /api/camps/campgrounds/{id}/campsites`
No key. Large (Mather = 357 sites, ~2.2 MB). Array `.campsites[]`. Per-site:

- **`campsite_type`** — e.g. `"RV NONELECTRIC"`, `"STANDARD NONELECTRIC"`,
  `"TENT ONLY NONELECTRIC"`, `"EQUESTRIAN NONELECTRIC"`. Tells you how many true
  **RV-capable** sites exist (vs the facility's total site count we already store).
- **`attributes[]`** — `{attribute_code, attribute_value}`. Distinct codes seen:
  - `electric_hookup` → `"30"` / `"50"` (amp service!) — present at electric campgrounds
  - `max_vehicle_length` → per-site ft (the *real* fit limit, varies site to site)
  - `driveway_entry` → `"Pull-Through"` / `"Back-In"` (huge for big rigs)
  - `driveway_surface` → `"Gravel"` / `"Paved"`, `driveway_grade` → `"Moderate"`, `driveway_length`
  - `shade` → `"Partial"` / `"Full"`, `proximity_water` → `"Riverfront"` / `"Oceanfront"`
  - `pets_allowed` → `"Domestic"`, `site_access` → `"Drive-In"` / `"Hike-In"`
  - `checkin_time`, `checkout_time`, `campfire_allowed`, `picnic_table`, `fire_pit`
- **`is_accessible`** — real per-site boolean (16/357 at Mather). Reliable; roll up to a facility "has accessible sites" flag.

### 3. Elevation (external, build-time) — DEM lookup
Three independent no-cost options, all verified against real campground coords
(Mather GC rim: all agree ~2123–2138 m):

| Source | Key? | Batch | Resolution | URL |
|---|---|---|---|---|
| **Open-Meteo** | none | up to 100 pts/call | Copernicus GLO-90 (90 m) | `https://api.open-meteo.com/v1/elevation?latitude=..&longitude=..` |
| USGS EPQS | none | single point | 3DEP 1m/10m (US only) | `https://epqs.nationalmap.gov/v1/json?x=LON&y=LAT&units=Meters&wkid=4326` |
| Open-Elevation | none | batch POST | SRTM | `POST https://api.open-elevation.com/api/v1/lookup` |

**Recommendation:** Open-Meteo as primary (no key, 100-point batches → 2561 sites
in ~26 calls), USGS EPQS as a US-only cross-check/fallback. Bake `elevationFt` per
campground at build; **never** call at runtime. Cite Copernicus GLO-90 / USGS 3DEP
as source.

---

## Prioritized "fields worth adding"

| # | Field(s) | Source | Coverage (sampled) | Per- | Unlocks |
|---|---|---|---|---|---|
| **1** | **Hookups & sanitation flags**: Electric Hookups, Dump Station, Drinking Water, Showers, Flush Toilets | facility `amenities` map | ~14/15 non-empty; elec ~6/15, dump ~9/15, water ~10/15, shower ~8/15 | facility | Filters: "full/partial hookups", "dump station", "potable water", "showers" — the #1 RV trip-planning questions |
| **2** | **Amp service** (30/50A) + **per-site max RV length** + **driveway type** (pull-through/back-in) | campsites `attributes` (`electric_hookup`, `max_vehicle_length`, `driveway_entry`) | amp: only at electric CGs; length/driveway: near-universal per site | campsite (roll up: max length, "has pull-through", amp range) | "Will my 25 ft Airstream fit?" + "30 vs 50 amp" + "can I avoid backing in?" — precise rig-fit beyond the single facility `maxLengthFt` we store now |
| **3** | **Elevation (ft)** | Open-Meteo GLO-90 (build-time) | 100% (every lat/lon) | facility | Boondocking temp estimate, "high/low desert vs alpine" filter, ties into existing off-grid estimator; sort/filter by elevation band |
| 4 | Pets Allowed | facility `amenities` | ~10/15 | facility | "pet-friendly" filter |
| 5 | Accessible sites | campsite `is_accessible` (NOT `facility_adaaccess`) | ~16/357 sites typical | campsite→rollup | ADA filter |
| 6 | RV-capable site count | campsite `campsite_type` ("RV/STANDARD … NONELECTRIC") | universal | campsite→rollup | "how many sites actually take an RV" vs total |
| 7 | Cell Phone Service | facility `amenities` + search `aggregate_cell_coverage` | sparse (~2/15 amenity) | facility | "connectivity" hint — label as approximate |

---

## Be honest: tempting but UNRELIABLE — AVOID

- **`facility_adaaccess`** — broken/stale, returns `"N"` even where accessible
  sites clearly exist. Never surface it. (Use per-site `is_accessible` instead.)
- **Season open/close dates** — no clean, consistent structured field. There is a
  per-site `recurring_closures` blob but it's messy and incomplete; deriving a
  facility "open season" reliably is not feasible. **Avoid** as a filter.
- **Generator rules / quiet hours** — only buried in free-text `notices`/rules HTML,
  not a structured field. Not extractable reliably. Avoid.
- **`stay_limit`** — present in schema but frequently empty string. Low coverage;
  show only when non-empty, never as a filter.
- **Sewer hookups / full-hookup distinction** — RIDB amenity vocab has "Electric
  Hookups" and "Drinking Water" but a clean "Sewer/Full Hookup" amenity is rare on
  federal land (most NPS/USFS sites are electric-only at best). Don't promise a
  "full hookup" filter; "electric hookup" + "dump station" is the honest framing.
- **Per-site cell coverage** — `aggregate_cell_coverage` exists in search results
  but is a coarse aggregate; label any connectivity hint as approximate.

---

## Build / integration notes

- Pattern: extend `scripts/campdata/collect.mjs` to, for each kept campground, also
  `curl` the two `/api/camps/...` endpoints (no key, same UA) + one batched
  Open-Meteo call. Rate-limit politely (existing 400 ms sleep). 2561 facilities ×
  2 calls ≈ 5k requests — run once at dev time, commit enriched JSON.
- Normalize the free-text `amenities` map → a small fixed set of booleans
  (`hasElectric`, `ampService`, `hasDump`, `hasPotableWater`, `hasShowers`,
  `petsAllowed`, `hasAccessibleSites`) at build, so the runtime/filters stay simple
  and CSP-safe. Keep raw labels too for a detail list.
- Roll up campsite attributes to facility level: `maxRvLengthFt` (max over
  RV-capable sites), `hasPullThrough` (bool), `rvSiteCount`, `accessibleSiteCount`.
- The `/campsites` payloads are large (MB-scale); fetch, extract the rollups, and
  **discard the raw** — do not bake 2.2 MB/site into the committed JSON.
- Source attribution for the site footer: "Recreation.gov (RIDB), public data" +
  "Elevation: Copernicus GLO-90 via Open-Meteo / USGS 3DEP".

## Verified source URLs
- Public search API (current): `https://www.recreation.gov/api/search?entity_type=campground`
- Facility detail (no key): `https://www.recreation.gov/api/camps/campgrounds/232490`
- Campsites (no key): `https://www.recreation.gov/api/camps/campgrounds/232490/campsites`
- RIDB v1 (key-gated, NOT needed): `https://ridb.recreation.gov/api/v1` (returns 401 w/o key)
- Open-Meteo Elevation: `https://open-meteo.com/en/docs/elevation-api`
- USGS EPQS: `https://epqs.nationalmap.gov/v1/json`
- Open-Elevation: `https://api.open-elevation.com/api/v1/lookup`
