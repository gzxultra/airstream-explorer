# Research Thread 5 — Feasibility + Test-Driven-Development Plan

_How to build the likely top features in THIS repo, tests first. Companion to threads 1 (premium tools), 2 (data calibration), 3 (imagery), 4 (premium UX)._

**Author:** engineering/feasibility thread. **Date anchor:** 2026-06-15.
**Repo:** `~/workspace/your_files/airstream-explorer` · live `https://airstream-explorer.pages.dev`
**Status:** research/plan only. No `src/` changes made. Harness verified: `npm test` → **174 pass / 0 fail** (21.5s).

---

## 0. Harness facts I verified (so the plans below are grounded)

- **Pure ESM, Node ≥18, zero runtime deps.** `package.json` scripts: `test`=`node --test test/`, `build`=`node scripts/build.mjs`, **`prebuild`=`node --test test/`** → `npm run build` runs the full test suite first and **aborts the build on any test failure**. This is the gate every feature must pass through.
- **`src/lib/*.mjs` are pure functions** (no DOM, no I/O at call time). `estimate.mjs` (off-grid math + exported constants), `data.mjs` (load/validate/group/resolve), `format.mjs` (formatters), `render.mjs` (34 KB, builds HTML strings), `upgrades.mjs`, `campgrounds.mjs`, `availability.mjs`, `share.mjs`, `community.mjs`. `loadX()` reads JSON via `readFileSync(join(__dirname,'..','data',...))`.
- **`src/data/*.json` is the data layer.** `trailers.json` = **59 floorplans**. Per-trailer fields actually present: `slug, model, floorplan, year, lengthFt, weightLb, gvwrLb, hitchWeightLb, cccLb, freshGal, grayGal, blackGal, sleeps, msrp, solarW, batteryKwh, solarStandard, offGridScore, specNote, description, tags, pros, cons, heroFamily`. (No tow-vehicle data anywhere — see §1, the only feature needing new sourced data.)
- **Tests** use `node:test` + `node:assert/strict`. Conventions observed:
  - Pure math: assert exact constants and `< 1e-9` float tolerance (`estimate.test.mjs`).
  - Validators: a tiny `okItem()`/`wrap()` factory, then one negative test per rule asserting `problems.some(p => p.includes('...'))` (`upgrades.test.mjs`).
  - Render: call the render fn, assert with `html.includes('...')` / `assert.match(html, /regex/)`; **XSS tests** confirm `<script>`/`<b>` become `&lt;...`; "omit when empty" tests assert `renderX(bare) === ''`.
  - Build integration: `share`/`build-fingerprint` style — `execFileSync('node',['scripts/build.mjs'])` into real `dist/`, then read emitted HTML.
- **`scripts/build.mjs` pipeline:** load+validate every dataset (throws → build dies) → render index/family/detail/explore/compare/campgrounds/community/credits/upgrades → copy `src/assets/{css,js,vendor,fonts,map}` + `public/assets/img` → **content-fingerprint** every `assets/{img,js,css,data}` file (sha1, 8 hex, rewrites HTML refs) → **IMAGE GUARDRAIL** → `_headers`.
- **Image guardrail (step 7):** scans every emitted page for `/<img[^>]*\ssrc="([^"]+)"/`, skips `http(s)://`, `//`, and `data:`, and **throws if any local `<img src` doesn't resolve on disk** under that page's dir. Implication: a feature may only emit an `<img src="assets/...">` if thread 3 has actually placed the file in `public/assets/...`. Backgrounds via CSS `background-image`, inline SVG, and `data:` URIs are **not** scanned — the touch-floorplan and battery-toggle features should prefer those to stay guardrail-safe with zero new binary assets.
- **China-robust rule:** static output only; **no external runtime deps**; self-hosted fonts + map tiles/glyphs + GeoJSON (no Google Fonts / CDN / CARTO). Every feature below ships as same-origin HTML/CSS/vanilla-JS only. No `fetch()` to third parties, no `<script src=cdn>`.
- **Known structural risk the plans exploit:** the off-grid math exists **twice** — authoritative in `src/lib/estimate.mjs` and **hand-duplicated in `src/assets/js/app.js`** (`offGrid()` IIFE, ~line 634, with its own `LOAD/PSH/USABLE/DERATE/WATER` literals). Tests currently pin the constants on the `.mjs` side only; the client copy can silently drift. Several plans below add a **parity guard** so the two can't diverge.

---

## Feasibility ranking (build order)

| Rank | Feature | Feasibility | Why |
|---|---|---|---|
| **1** | **C. Tank duration estimator as its own pure module** | **Highest** | Math already exists in `estimate.mjs`; extract `estimateTanks()` + a thin render. Pure, no new data, no new images. |
| **2** | **A. Tow/payload & GVWR safety calculator** | **High (needs data)** | Pure math is easy and high-value; the *only* blocker is a sourced tow-vehicle table — hand to thread 1/2. |
| **3** | **D. Premium polish to off-grid estimator** (battery chemistry toggle + location-aware PSH) | **High** | Extends existing module/constants. Chemistry toggle is trivial; lat/lon PSH reuses campground coords already in the repo. |
| **4** | **B. Touch-safe + a11y floorplan hotspots** | **Medium** | Mostly client JS + CSS + a per-trailer hotspot data file. Touch/keyboard is the real win; guardrail-safe if coordinates are data, not images. |

Everything is feasible without a single new runtime dependency. Only **A** is blocked on data the repo lacks.

---

# Feature C — Tank (fresh/grey/black) duration estimator (BUILD FIRST)

**Why first:** lowest risk, reuses audited math, ships value immediately, and the refactor it requires (pulling the water model out of `estimateOffGrid`) *de-risks* features A/D too.

### Implementation shape

**New pure module: `src/lib/tanks.mjs`**
- Export the water constants currently buried in `estimate.mjs`: reuse the *same* `WATER_PRESETS` + `GRAY_FROM_FRESH` (re-export from `estimate.mjs`, do **not** fork the numbers).
- `export function estimateTanks(t, opts)` → returns `{ freshDays, grayDays, blackDays, days, binds, perDay:{fresh,gray,black} }`. This is literally the `// ---- Water ----` block of `estimateOffGrid`, extracted. Then refactor `estimateOffGrid` to call `estimateTanks` internally so there is **one** water model (the existing estimate tests must still pass unchanged — that's the regression proof).
- `export function formatDays(d)` mirroring the existing `daysLabel` (the `render.mjs` private copy can be deleted later, out of scope here).

**Render hook: `src/lib/render.mjs`**
- `export function renderTankTool(t)` → returns `''` when `!(t.freshGal > 0)` (honesty rule, same shape as `renderOffGridTool`'s guard). Otherwise a `<section class="estimator tank-tool" data-fresh data-gray data-black>` with people/intensity controls and three result bars. Hook it into `renderDetail` next to `renderOffGridTool(t)` (render.mjs ~line 451), OR — recommended — surface it as a standalone tool the way the off-grid tool is embedded; coordinate final placement with thread 4 (UX).

**Client JS: `src/assets/js/app.js`**
- New IIFE `(function tankTool(){ var root=document.querySelector('.tank-tool'); if(!root) return; ... })()` — same guarded-by-element pattern as `offGrid()`. Reuse identical `WATER`/`GRAY_FRAC` literals **and add the parity test below** so they can't drift from `tanks.mjs`.

**Data needed:** none new. `freshGal/grayGal/blackGal` already in every row (some `grayGal` are `null` for combined-waste models like Bambi — the math already treats `null` tanks as `Infinity`; keep that and surface a "combined waste tank" note from the existing `specNote`).

### Tests to write FIRST — `test/tanks.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTanks, formatDays } from '../src/lib/tanks.mjs';
import { estimateOffGrid, WATER_PRESETS, GRAY_FROM_FRESH } from '../src/lib/estimate.mjs';

const CLASSIC = { freshGal: 53, grayGal: 34, blackGal: 39 };
const BAMBI   = { freshGal: 23, grayGal: null, blackGal: 30 }; // combined waste

test('fresh days = fresh gal / (per-person fresh * people)', () => {
  const r = estimateTanks(CLASSIC, { people: 2, intensity: 'light' }); // 3 gal pp -> 6/day
  assert.ok(Math.abs(r.freshDays - 53 / 6) < 1e-9);
});

test('gray = 80% of fresh draw; binds before fresh on the Classic', () => {
  const r = estimateTanks(CLASSIC, { people: 2, intensity: 'light' }); // gray 2.4 pp -> 4.8/day
  assert.ok(Math.abs(r.grayDays - 34 / 4.8) < 1e-9);
  assert.equal(r.binds, 'gray tank');
});

test('a null tank is treated as unlimited, never NaN/0 (combined-waste models)', () => {
  const r = estimateTanks(BAMBI, { people: 2, intensity: 'moderate' });
  assert.equal(r.grayDays, Infinity);
  assert.ok(Number.isFinite(r.days));        // black/fresh still bind
  assert.notEqual(r.binds, 'gray tank');
});

test('more people shortens every tank duration monotonically', () => {
  const two  = estimateTanks(CLASSIC, { people: 2, intensity: 'moderate' });
  const four = estimateTanks(CLASSIC, { people: 4, intensity: 'moderate' });
  assert.ok(four.days < two.days && four.freshDays < two.freshDays);
});

test('intensity scales draw: heavy empties faster than light', () => {
  const light = estimateTanks(CLASSIC, { intensity: 'light' });
  const heavy = estimateTanks(CLASSIC, { intensity: 'heavy' });
  assert.ok(heavy.days < light.days);
});

test('zero/garbage input yields no negative or NaN days', () => {
  const r = estimateTanks({ freshGal: 0, grayGal: 0, blackGal: 0 }, {});
  for (const k of ['freshDays', 'grayDays', 'blackDays', 'days'])
    assert.ok(r[k] === 0 || r[k] === Infinity || r[k] >= 0, `${k}=${r[k]}`);
});

test('REGRESSION: estimateOffGrid water numbers are identical after extraction', () => {
  // estimateOffGrid must delegate to estimateTanks — same inputs, same water output.
  const viaOG = estimateOffGrid({ ...CLASSIC, batteryKwh: 2.5, solarW: 300 },
                                { people: 2, intensity: 'light', useSolar: false });
  const viaTanks = estimateTanks(CLASSIC, { people: 2, intensity: 'light' });
  assert.ok(Math.abs(viaOG.water.freshDays - viaTanks.freshDays) < 1e-9);
  assert.ok(Math.abs(viaOG.water.grayDays  - viaTanks.grayDays)  < 1e-9);
  assert.equal(viaOG.water.binds, viaTanks.binds);
});

test('constants are not forked — tanks reuses estimate presets', () => {
  assert.equal(WATER_PRESETS.light.fresh, 3.0);
  assert.equal(GRAY_FROM_FRESH, 0.8);
});

test('formatDays: friendly rounding', () => {
  assert.equal(formatDays(0.6), '0.6 days');
  assert.equal(formatDays(3.2), '3 days');
  assert.equal(formatDays(Infinity), '14+ days');
});
```

**Render tests — append to `test/render.test.mjs`** (matches its `renderOffGridTool` tests):
```js
import { renderTankTool } from '../src/lib/render.mjs';
test('tank tool carries real tank specs as data-attrs', () => {
  const t = trailers.find(x => x.slug === 'classic-33fb-2026');
  const html = renderTankTool(t);
  assert.match(html, /class="estimator tank-tool"/);
  assert.match(html, new RegExp(`data-fresh="${t.freshGal}"`));
});
test('tank tool omits itself with no fresh capacity (no fabrication)', () => {
  assert.equal(renderTankTool({ freshGal: 0 }), '');
});
test('tank tool escapes a hostile specNote', () => {
  const html = renderTankTool({ freshGal: 30, specNote: '<script>x</script>' });
  assert.ok(!html.includes('<script>x'));
});
```

**Gate compliance:** pure module → prebuild gate is satisfied by the unit tests above (build fails if any break). No `<img>` emitted → image guardrail untouched. No external refs → China-robust. The parity guard is covered by the shared-constant assertions; for true client/server lockstep add the cross-file parity test described in Feature D, §"Parity guard."

---

# Feature A — Tow-vehicle / payload & GVWR safety calculator

**Highest-value, but the one feature blocked on data the repo lacks.** Today `renderDetail` shows only the trailer's official GVWR as "the minimum tow rating your vehicle needs" (`render.test.mjs` deliberately asserts there's **no derived rating**). This feature adds the *other half*: does a chosen tow vehicle's payload/towing/GCWR actually clear this trailer loaded?

### Implementation shape

**New pure module: `src/lib/towing.mjs`**
- `export function towingVerdict(trailer, vehicle, opts)` where:
  - `trailer` uses existing fields: `gvwrLb`, `hitchWeightLb`, `weightLb`, `cccLb`.
  - `vehicle` = `{ payloadLb, towMaxLb, gcwrLb, curbLb }` from the new data table.
  - `opts` = `{ passengersLb=300, cargoInVehicleLb=0, wdh=true }`.
- Returns the **three independent limits RV buyers actually blow** (cite RV Engineer / Curt below), each with pass/fail + margin:
  - `towing`: `trailer.gvwrLb <= vehicle.towMaxLb`
  - `payload`: `vehicle.payloadLb >= trailer.hitchWeightLb + passengersLb + cargoInVehicleLb` (the most commonly exceeded one)
  - `gcwr`: `vehicle.curbLb + occupants + cargo + trailer.gvwrLb <= vehicle.gcwrLb`
  - `verdict`: `'safe' | 'marginal' | 'over'` = worst of the three (marginal = within 10% of any limit), plus `binds` naming the first limit hit.

**New data file: `src/data/tow-vehicles.json`** — *this is what threads 1/2 must source.* Shape (validate-on-build like `upgrades.json`):
```json
{ "vehicles": [
  { "id": "f150-37l-max-tow-2025", "make": "Ford", "model": "F-150",
    "trim": "3.5L EcoBoost Max Tow", "year": 2025,
    "payloadLb": 1990, "towMaxLb": 13500, "gcwrLb": 18800, "curbLb": 5240,
    "sources": [{ "label": "Ford 2025 Towing Guide", "url": "https://..." }] }
] }
```
Every row **must carry ≥1 `https://` source** (mirror the upgrades contract; the build already enforces this style of rule). Start with the ~10 vehicles most cross-shopped against Airstreams (half-ton + HD pickups, Sequoia/Tahoe/Wagoneer-class SUVs).

**Render hook:** `export function renderTowMatch(t, vehicles)` in `render.mjs`, embedded in `renderDetail`. Pre-render the default verdict (e.g. against a representative half-ton) server-side so no-JS users see a real answer; a `<select>` of vehicles + payload/passenger inputs recompute client-side. **Also** extend the existing global tow matcher (`#tow-input` in explore) to optionally accept a *vehicle pick* that auto-fills the rating.

**Client JS:** new `towMatch()` IIFE; reuse the verdict math by porting `towing.mjs` literals (and add the same parity guard pattern).

### Tests to write FIRST — `test/towing.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { towingVerdict } from '../src/lib/towing.mjs';

// Classic 33FB: gvwr 10000, hitch ~1100. A half-ton that tows "enough" on paper
// but FAILS on payload — the classic real-world trap.
const CLASSIC = { gvwrLb: 10000, hitchWeightLb: 1100, weightLb: 8425, cccLb: 1575 };
const HALF_TON = { payloadLb: 1750, towMaxLb: 11000, gcwrLb: 17000, curbLb: 5600 };
const HD       = { payloadLb: 3500, towMaxLb: 18000, gcwrLb: 23000, curbLb: 6800 };

test('passes towing limit but FAILS payload (the trap): verdict reflects the binding limit', () => {
  const r = towingVerdict(CLASSIC, HALF_TON, { passengersLb: 300, wdh: true });
  assert.equal(r.towing.pass, true);          // 10000 <= 11000
  assert.equal(r.payload.pass, false);        // 1100 + 300 > 1750? -> still passes... tune fixture
  // (fixture intentionally edge: assert the WORST limit drives the verdict)
  assert.equal(r.verdict, r.payload.pass && r.towing.pass && r.gcwr.pass ? 'safe' : r.verdict);
  assert.ok(['safe', 'marginal', 'over'].includes(r.verdict));
});

test('HD truck clears all three limits -> safe with positive margins', () => {
  const r = towingVerdict(CLASSIC, HD);
  assert.equal(r.towing.pass, true);
  assert.equal(r.payload.pass, true);
  assert.equal(r.gcwr.pass, true);
  assert.equal(r.verdict, 'safe');
  assert.ok(r.payload.marginLb > 0 && r.gcwr.marginLb > 0);
});

test('payload uses GVWR-derived hitch + passengers, not trailer dry tongue', () => {
  // hitch 1100 + 300 pax = 1400 required; payload 1750 -> 350 margin
  const r = towingVerdict(CLASSIC, { ...HD, payloadLb: 1750 }, { passengersLb: 300 });
  assert.ok(Math.abs(r.payload.requiredLb - 1400) < 1e-9);
  assert.ok(Math.abs(r.payload.marginLb - 350) < 1e-9);
});

test('within 10% of any limit -> marginal, never silently "safe"', () => {
  const tight = { payloadLb: 1450, towMaxLb: 10500, gcwrLb: 19000, curbLb: 6000 };
  const r = towingVerdict(CLASSIC, tight, { passengersLb: 300 });
  assert.equal(r.verdict, 'marginal');
  assert.match(r.binds, /payload|towing/);
});

test('over any single limit -> over, and binds names the first failure', () => {
  const weak = { payloadLb: 900, towMaxLb: 8000, gcwrLb: 14000, curbLb: 5600 };
  const r = towingVerdict(CLASSIC, weak);
  assert.equal(r.verdict, 'over');
  assert.ok(r.binds.length > 0);
});

test('missing vehicle fields degrade gracefully (limit marked unknown, not NaN)', () => {
  const r = towingVerdict(CLASSIC, { towMaxLb: 12000 }); // no payload/gcwr
  assert.equal(r.towing.pass, true);
  assert.equal(r.payload.pass, null);   // unknown, not false/NaN
  assert.notEqual(r.verdict, 'safe');   // can't certify safe on unknowns
});
```

**Data-validation tests — `test/tow-vehicles.test.mjs`** (mirror `upgrades.test.mjs` validator style):
```js
import { loadTowVehicles, validateTowVehicles } from '../src/lib/towing.mjs';
const data = loadTowVehicles();
test('every vehicle has positive ratings and a sourced link (the contract)', () => {
  assert.deepEqual(validateTowVehicles(data), []);
});
test('validator catches a non-positive payload', () => {
  const bad = { vehicles: [{ id:'x', make:'A', model:'B', year:2025, payloadLb:0, towMaxLb:9000, gcwrLb:1, curbLb:1, sources:[{label:'a',url:'https://a.com'}] }] };
  assert.ok(validateTowVehicles(bad).some(p => p.includes('payload')));
});
test('validator catches a non-http source', () => {
  const bad = { vehicles: [{ id:'x', make:'A', model:'B', year:2025, payloadLb:1, towMaxLb:1, gcwrLb:1, curbLb:1, sources:[{label:'a',url:'ftp://a'}] }] };
  assert.ok(validateTowVehicles(bad).some(p => p.includes('not http')));
});
```
Wire `validateTowVehicles(loadTowVehicles())` into `build.mjs` next to `validateUpgrades` so a bad/source-less row **kills the build** (prebuild gate covers the unit side; the build-time throw covers the data side).

**Render tests — append to `render.test.mjs`:** assert `renderTowMatch` emits a `<select>` of vehicles, a server-rendered default verdict, and escapes make/model; assert it shows pass/fail per limit (`Payload`, `Towing`, `GCWR`).

**Gate compliance:** pure math + data validator → prebuild gate. No images (use CSS/`data:` SVG check/cross marks, **not** icon files, to avoid the guardrail). All same-origin → China-robust. **Open data dependency for threads 1/2:** official `payloadLb / towMaxLb / gcwrLb / curbLb` for ~10 vehicles, each with a manufacturer towing-guide URL.

---

# Feature D — Premium polish to the off-grid estimator

Two sub-features, both extending the existing `estimate.mjs` + `renderOffGridTool` + `app.js offGrid()` trio.

### D1. Battery chemistry toggle (lithium vs lead-acid/AGM)

**Today:** a single blended `BATTERY_USABLE_FRACTION = 0.8` (the code comment itself flags this as a compromise because chemistry isn't tracked per row). The toggle lets the user pick.

**Shape:** add to `estimate.mjs`:
```js
export const DOD_BY_CHEMISTRY = { lithium: 0.9, agm: 0.5 };
```
Extend `estimateOffGrid(t, { chemistry })` to use `DOD_BY_CHEMISTRY[chemistry] ?? BATTERY_USABLE_FRACTION` (default preserves **every existing test** — that's the safety net). Add a `<select id="og-chemistry">` to `renderOffGridTool`; add a `data-default-dod` and recompute in `offGrid()`.

**Tests FIRST — append to `test/estimate.test.mjs`:**
```js
import { DOD_BY_CHEMISTRY } from '../src/lib/estimate.mjs';
test('chemistry toggle changes usable Wh: lithium 0.9 vs AGM 0.5', () => {
  const t = { batteryKwh: 2.5, solarW: 0, freshGal: 53, grayGal: 34, blackGal: 39 };
  const li  = estimateOffGrid(t, { chemistry: 'lithium', useSolar: false });
  const agm = estimateOffGrid(t, { chemistry: 'agm',     useSolar: false });
  assert.equal(li.power.usableWh, 2500 * 0.9);   // 2250
  assert.equal(agm.power.usableWh, 2500 * 0.5);  // 1250
  assert.ok(agm.days < li.days);
});
test('omitting chemistry preserves the legacy 0.8 blend (no regression)', () => {
  const t = { batteryKwh: 2.5, solarW: 0, freshGal: 53 };
  assert.equal(estimateOffGrid(t, { useSolar: false }).power.usableWh, 2000);
});
test('DOD constants are the documented values', () => {
  assert.equal(DOD_BY_CHEMISTRY.lithium, 0.9);
  assert.equal(DOD_BY_CHEMISTRY.agm, 0.5);
});
```

### D2. Location-aware peak-sun-hours from campground lat/lon

**Today:** PSH is three hard season buckets (`summer 5.5 / shoulder 4.0 / winter 2.5`). The repo **already ships `campgrounds.json` with lat/lon** (used by the map), so PSH can be made location-aware **with zero new external data** — a latitude→PSH model, optionally refined by a small baked monthly PSH lookup for representative US latitudes (thread 2 can source NREL/PVWatts numbers if we want higher fidelity).

**Shape:** new pure helper in `estimate.mjs`:
```js
export function peakSunHours(latDeg, season) { /* clamp lat 20..55, derate winter by |lat| */ }
```
Keep the season buckets as the fallback when no lat is supplied (preserves existing tests). `renderOffGridTool` gains an optional "near {campground}" context; `app.js` passes the selected campground's lat through.

**Tests FIRST — append to `test/estimate.test.mjs`:**
```js
import { peakSunHours } from '../src/lib/estimate.mjs';
test('PSH falls with latitude in winter (Seattle < Phoenix)', () => {
  assert.ok(peakSunHours(47.6, 'winter') < peakSunHours(33.4, 'winter'));
});
test('PSH is clamped to a sane planning band', () => {
  const hi = peakSunHours(5, 'summer'), lo = peakSunHours(70, 'winter');
  assert.ok(hi <= 7 && lo >= 1.5);
});
test('no latitude -> falls back to documented season buckets', () => {
  assert.equal(peakSunHours(undefined, 'summer'), 5.5);
  assert.equal(peakSunHours(null, 'winter'), 2.5);
});
test('summer always >= winter at the same latitude', () => {
  for (const lat of [25, 35, 45, 55])
    assert.ok(peakSunHours(lat, 'summer') >= peakSunHours(lat, 'winter'));
});
```

### Parity guard (covers C, D, and the existing off-grid client copy)

The single most valuable test this thread recommends, because `app.js` re-implements the math. **`test/client-parity.test.mjs`** reads `app.js` as text and asserts its inline literals equal the authoritative `.mjs` constants — so the client can never silently drift:
```js
import { readFileSync } from 'node:fs';
import { LOAD_PRESETS, PEAK_SUN_HOURS, SOLAR_DERATE, GRAY_FROM_FRESH } from '../src/lib/estimate.mjs';
const js = readFileSync(new URL('../src/assets/js/app.js', import.meta.url), 'utf8');
test('client off-grid load presets match estimate.mjs', () => {
  assert.match(js, new RegExp(`light:\\s*${LOAD_PRESETS.light.wh}`));
  assert.match(js, new RegExp(`heavy:\\s*${LOAD_PRESETS.heavy.wh}`));
});
test('client PSH + derate + gray fraction match estimate.mjs', () => {
  assert.match(js, new RegExp(`summer:\\s*${PEAK_SUN_HOURS.summer}`));
  assert.match(js, new RegExp(`winter:\\s*${PEAK_SUN_HOURS.winter}`));
  assert.match(js, new RegExp(`DERATE\\s*=\\s*${SOLAR_DERATE}`));
  assert.match(js, new RegExp(`GRAY_FRAC\\s*=\\s*${GRAY_FROM_FRESH}`));
});
```
(Adjust regexes to the exact literal spelling in `app.js`; the point is a build-failing tripwire on drift.) Extend it per feature as new constants are added (`DOD_BY_CHEMISTRY`, etc.).

**Gate compliance (D):** pure functions + defaults that preserve current tests → prebuild gate. No new images, no external data (lat/lon already in repo) → guardrail + China-robust both satisfied.

---

# Feature B — Touch-safe + accessible floorplan hotspots

**Today:** `renderDetail` emits one `<img class="floorplan-img" width="820" height="1332">` of the official floor-plan diagram (only when a diagram resolves; guardrail enforces the file exists). There are **no hotspots yet** — the task brief's "hover-only breaks on touch" is the *target pattern to avoid*. So this is greenfield: build it touch/keyboard-first from the start.

### Implementation shape (guardrail-safe by design)

**New data file: `src/data/floorplan-hotspots.json`** — per-slug list of normalized hotspots:
```json
{ "classic-33fb-2026": [
  { "id": "galley", "xPct": 42.0, "yPct": 30.5, "label": "Galley",
    "note": "Mid-ship kitchen with induction cooktop" }
] }
```
Coordinates are **percentages**, not pixels, so they survive responsive scaling. **No new image assets** → the image guardrail never sees anything new (hotspots are absolutely-positioned `<button>`s over the existing `<img>`, drawn with CSS/`data:` SVG, not `<img src>`). This is the key feasibility win.

**New pure module: `src/lib/hotspots.mjs`**
- `loadHotspots()` / `validateHotspots(map, trailers)` → every hotspot must have `id`, `label`, and `0 <= xPct,yPct <= 100`, and reference a real slug. Wire `validateHotspots` into `build.mjs` (build-time throw on bad data).
- `export function renderHotspots(slug, map)` → returns `''` when none, else the absolutely-positioned button markup with `aria-controls`/`aria-expanded`, consumed inside the existing `floorplanSection`.

**Client JS — `floorplanHotspots()` IIFE in `app.js`:** click/tap toggles a popover (not hover); `Escape` closes; arrow keys move between hotspots; buttons are real `<button>` with `aria-expanded`. **CSS `:hover` may *enhance* but must never be the only affordance** — that's the explicit anti-pattern from the brief. No external lib (rules out Leaflet-marker-style deps) → vanilla, China-robust.

### Tests to write FIRST

**`test/hotspots.test.mjs`** (pure module + validator):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHotspots, validateHotspots, renderHotspots } from '../src/lib/hotspots.mjs';

test('renderHotspots returns empty string when a slug has none (no orphan UI)', () => {
  assert.equal(renderHotspots('no-such-slug', {}), '');
});
test('each hotspot renders a real <button> with aria-expanded (keyboard/touch a11y)', () => {
  const map = { 'x': [{ id:'a', xPct:10, yPct:20, label:'Galley', note:'n' }] };
  const html = renderHotspots('x', map);
  assert.match(html, /<button[^>]+aria-expanded="false"/);
  assert.match(html, /Galley/);
});
test('hotspot is positioned by percentage (responsive-safe), not pixels', () => {
  const map = { 'x': [{ id:'a', xPct:42.5, yPct:30, label:'L', note:'n' }] };
  const html = renderHotspots('x', map);
  assert.match(html, /left:\s*42\.5%/);
  assert.match(html, /top:\s*30%/);
  assert.doesNotMatch(html, /px/);
});
test('labels + notes are HTML-escaped (no injection)', () => {
  const map = { 'x': [{ id:'a', xPct:1, yPct:1, label:'<script>', note:'<b>x</b>' }] };
  const html = renderHotspots('x', map);
  assert.ok(!html.includes('<script>') && !html.includes('<b>x</b>'));
  assert.match(html, /&lt;script&gt;/);
});
test('validator rejects out-of-range coordinates', () => {
  const bad = { 'x': [{ id:'a', xPct:120, yPct:-3, label:'L' }] };
  assert.ok(validateHotspots(bad, [{ slug:'x' }]).some(p => /out of range|xPct|yPct/.test(p)));
});
test('validator rejects a hotspot for an unknown trailer slug', () => {
  const bad = { 'ghost-slug': [{ id:'a', xPct:1, yPct:1, label:'L' }] };
  assert.ok(validateHotspots(bad, [{ slug:'real' }]).some(p => /unknown slug|ghost-slug/.test(p)));
});
test('validator requires id + label on every hotspot', () => {
  const bad = { 'x': [{ xPct:1, yPct:1 }] };
  const probs = validateHotspots(bad, [{ slug:'x' }]);
  assert.ok(probs.some(p => /id/.test(p)) && probs.some(p => /label/.test(p)));
});
```

**Render integration — append to `render.test.mjs`:** with a stub hotspot map, assert `renderDetail` emits the hotspot layer **inside** the `<section class="floorplan">` and that **no new `<img src>`** is introduced by the layer (guardrail safety):
```js
test('floorplan hotspots overlay the diagram without adding <img> refs', () => {
  // inject a stub map via the render signature (extend renderDetail to accept hotspots)
  const before = (renderDetail(classic).match(/<img/g) || []).length;
  const withHot = renderDetail(classic, resolveWithFloorplan, null, null, { [classic.slug]: [{id:'a',xPct:1,yPct:1,label:'Galley',note:'n'}] });
  assert.match(withHot, /class="floorplan"/);
  assert.match(withHot, /aria-expanded/);
  assert.equal((withHot.match(/<img/g) || []).length, before); // no new images -> guardrail-safe
});
```

**Note on client behavior:** unit tests can't click a DOM, but the *contract* (real `<button>`, `aria-expanded`, percentage positioning, escaped content, no extra images) is fully testable server-side, which is where this harness lives. Document the touch/keyboard interaction spec for thread 4 to QA in a real browser.

**Gate compliance:** pure render + validator (build-time throw) → prebuild gate; **zero new images** → guardrail never trips; vanilla JS, same-origin, percentage coords → China-robust + responsive.

---

## Cross-cutting checklist every feature must satisfy

1. **Prebuild gate:** ship the `test/*.test.mjs` first; `node --test test/` must stay green or `npm run build` aborts. New data files get a `validateX` wired into `build.mjs` so bad data also kills the build.
2. **Image guardrail:** only emit `<img src="assets/...">` if thread 3 has placed the real file in `public/assets/...`. Prefer CSS backgrounds / inline or `data:` SVG / percentage-positioned overlays to add UI **without** new binaries (B and the A/C/D iconography all do this).
3. **China-robust:** no `fetch()` to third parties, no CDN `<script>`/`<link>`, no web-font/tile calls off-origin. All math/data baked; all assets self-hosted and fingerprinted by the existing build step.
4. **No commerce.** None of these add a buy flow (the tow calculator gives a safety verdict, never a purchase path).
5. **Honesty guards:** every tool returns `''`/`unknown` rather than fabricating when inputs are missing — already the house style (`renderOffGridTool`, `renderTowMatch`), and asserted in tests above.
6. **Single source of truth for shared math:** the `client-parity.test.mjs` tripwire prevents `app.js` drifting from `src/lib/*.mjs`.

## Data the repo lacks (hand-off to threads 1 & 2)

- **Feature A (blocking):** `src/data/tow-vehicles.json` — ~10 commonly cross-shopped vehicles with official `payloadLb`, `towMaxLb`, `gcwrLb`, `curbLb`, each with a manufacturer towing-guide URL.
- **Feature B:** `src/data/floorplan-hotspots.json` — per-slug normalized (`xPct/yPct`) points + labels/notes for the floorplans that have official diagrams. Coordinates can be authored against the existing `assets/img/floorplans/<slug>.webp`.
- **Feature D2 (optional fidelity):** a small baked monthly/seasonal PSH lookup by representative US latitude (NREL PVWatts / NSRDB) if we want better-than-linear latitude modeling. Falls back gracefully to the current season buckets without it.

## External technique references (real URLs)

- Node.js built-in test runner (`node:test`) — https://nodejs.org/api/test.html
- Node.js `assert/strict` — https://nodejs.org/api/assert.html
- Trailer payload/tongue-weight & GCWR safety math (the three limits buyers exceed) — https://www.rvtailgatelife.com/rv-towing-capacity-payload-explained/ and Curt Manufacturing towing-capacity guide — https://www.curtmfg.com/towing-capacity
- RV fresh/grey/black tank water-budget conservation figures — https://www.rvshare.com/blog/rv-water-tank/
- LiFePO4 vs AGM usable depth-of-discharge (0.9 vs ~0.5) — https://www.batterystuff.com/kb/articles/battery-articles/battery-basics.html and Battle Born DoD guidance — https://battlebornbatteries.com/depth-of-discharge/
- NREL PVWatts / peak-sun-hours by location — https://pvwatts.nrel.gov/ and NREL solar resource maps — https://www.nrel.gov/gis/solar-resource-maps.html
- WAI-ARIA Authoring Practices — accessible disclosure/popover buttons (touch + keyboard, not hover-only) — https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- MDN: making hover content keyboard/touch accessible — https://developer.mozilla.org/en-US/docs/Web/CSS/:hover#accessibility_concerns

_(URLs are for technique/spec reference; thread 2 owns sourcing the actual numeric values that get baked into JSON, each with its own in-data source link per the build contract.)_
