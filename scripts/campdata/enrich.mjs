// Enrich the baked campground dataset with PER-CAMPSITE detail pulled from
// Recreation.gov's no-key public endpoints, at dev/build time, baked static.
// Companion to collect.mjs (which writes the base records). This script only
// ADDS fields to each record in src/data/campgrounds.json; it never removes the
// existing shape. Zero runtime deps — the live site stays fully static.
//
// Data source: Recreation.gov public JSON (no API key needed):
//   facility : GET /api/camps/campgrounds/{id}            -> { campground: { amenities, ... } }
//   campsites: GET /api/camps/campgrounds/{id}/campsites  -> { campsites: [ {permitted_equipment, attributes, ...} ] }
//
// WHY per-campsite, not the facility amenity map: the HOOKUP and TRAILER-LENGTH
// truth lives at the campsite level. Gunter Hill's facility amenities list NO
// "Electric Hookups", yet 140/142 campsites are "STANDARD ELECTRIC" with
// "Electricity Hookup=50". And the search API's single maxLengthFt is the
// all-equipment (bus/motorhome) max — wrong for trailers. We re-derive the
// honest trailer figures from each site's own permitted_equipment + attributes.
//
// Usage:
//   node scripts/campdata/enrich.mjs --limit=40     # small batch first (verify)
//   node scripts/campdata/enrich.mjs                # full run (resumable)
//   node scripts/campdata/enrich.mjs --verify       # offline: roll up the 2 fixtures only
//   node scripts/campdata/enrich.mjs --elev-only    # only (re)compute elevation
// Resumable: per-id results are checkpointed under scripts/campdata/.cache/ so a
// re-run skips finished ids. Errors are NOT checkpointed, so they retry next run.
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', 'src', 'data', 'campgrounds.json');
const CACHE = join(HERE, '.cache');
const CKPT = join(CACHE, 'enrich-progress.json');   // id -> rollup | {unverified:true}
const ELEV_CKPT = join(CACHE, 'elevation.json');     // id -> elevationFt
const FIX = join(HERE, '..', '..', 'test', 'fixtures');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (hit) return hit.split('=')[1];
  return process.argv.includes(`--${k}`) ? true : d;
};

// --- curl a JSON endpoint to a tmp file, parse, delete tmp. Returns parsed
// object, null on a clean 404/410 (no such facility), or 'SKIP' on persistent
// failure. We stream to disk because /campsites can be multi-MB (Mather=2.2MB).
function curlJson(url, tag) {
  const tmp = `/tmp/enrich-${tag}-${process.pid}.json`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const code = execFileSync('curl', [
        '-s', '--max-time', '40', '-A', UA,
        '-H', 'accept: application/json',
        '-o', tmp, '-w', '%{http_code}', url,
      ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
      if (code === '404' || code === '410') { rmSync(tmp, { force: true }); return null; }
      if (code !== '200') throw new Error(`HTTP ${code}`);
      const data = JSON.parse(readFileSync(tmp, 'utf8'));
      rmSync(tmp, { force: true });
      return data;
    } catch (err) {
      rmSync(tmp, { force: true });
      if (attempt === 5) { return 'SKIP'; }
    }
  }
}

// ---------------------------------------------------------------------------
// PURE ROLLUP — exported-style fn (kept here, exercised by --verify against the
// committed fixtures). Given a campsites array + facility amenities map, derive
// the honest per-campground fields. Defensive against every quirk we verified:
//  - "STANDARD NONELECTRIC".includes("ELECTRIC") is TRUE, so hookups are derived
//    from the Electricity/Sewer/Full Hookup ATTRIBUTES, never the type string.
//  - MANAGEMENT sites (host/admin, not guest-bookable) are excluded from the
//    trailer length + site-count rollups so "% of sites that fit you" is honest.
//  - trailer length = a site's max permitted_equipment.max_length among
//    Trailer/RV/Fifth Wheel — NOT the all-equipment (bus) figure.
// ---------------------------------------------------------------------------
const TRAILER_RE = /Trailer|RV|Fifth/i;
const EXCLUDE_TYPE = /MANAGEMENT/i; // host/admin sites — not guest-bookable

export function rollupCampsites(campsites, amenities) {
  if (!Array.isArray(campsites) || campsites.length === 0) {
    return { unverified: true, reason: 'no campsites listed' };
  }
  const amen = amenities || {};
  const hasAmen = (name) => Object.keys(amen).some((k) => k.toLowerCase() === name.toLowerCase());

  let rvSiteCount = 0;
  let accessibleSiteCount = 0;
  let publicSiteCount = 0;
  let trailerMaxFt = 0;
  const hist = {};                 // rounded trailer max length (ft) -> count
  const amps = new Set();          // 30 / 50
  let anyElectric = false;
  let anySewer = false;            // Sewer Hookup or Full Hookup
  let anyWater = false;
  let hasPullThrough = false;

  for (const s of campsites) {
    // Only guest-bookable overnight sites count toward fit/site rollups.
    if (EXCLUDE_TYPE.test(s.campsite_type || '')) continue;
    if (s.type_of_use && s.type_of_use !== 'Overnight') continue;
    publicSiteCount++;
    if (s.is_accessible) accessibleSiteCount++;

    // --- trailer fit: max length among Trailer/RV/Fifth equipment for THIS site
    let siteTrailerMax = 0;
    let isRV = false;
    for (const e of (s.permitted_equipment || [])) {
      if (TRAILER_RE.test(e.equipment_name || '')) {
        isRV = true;
        const L = Number(e.max_length) || 0;
        if (L > siteTrailerMax) siteTrailerMax = L;
      }
    }
    if (isRV) {
      rvSiteCount++;
      if (siteTrailerMax > 0) {
        if (siteTrailerMax > trailerMaxFt) trailerMaxFt = siteTrailerMax;
        const bucket = Math.round(siteTrailerMax);
        hist[bucket] = (hist[bucket] || 0) + 1;
      }
    }

    // --- hookups: read the ATTRIBUTES (clean), never the type string
    for (const a of (s.attributes || [])) {
      const name = a.attribute_name;
      const val = String(a.attribute_value == null ? '' : a.attribute_value);
      if (name === 'Electricity Hookup') {
        // values seen: "30", "50", or junk "Electricity Hookup"/"Y"
        anyElectric = true;
        const n = parseInt(val, 10);
        if (n === 30 || n === 50) amps.add(n);
      } else if (name === 'Sewer Hookup' || name === 'Full Hookup') {
        if (val && val.toUpperCase() !== 'N' && val !== '0') anySewer = true;
      } else if (name === 'Water Hookup') {
        if (val && val.toUpperCase() !== 'N' && val !== '0') anyWater = true;
      } else if (name === 'Driveway Entry') {
        if (/Pull-?Through/i.test(val)) hasPullThrough = true;
      }
    }
  }

  // No guest-bookable sites at all (e.g. every site MANAGEMENT) -> unverified.
  if (publicSiteCount === 0) return { unverified: true, reason: 'no guest-bookable sites' };

  let hookups;
  if (anySewer) hookups = 'full';
  else if (anyElectric) hookups = 'electric';
  else hookups = 'none';

  return {
    rvSiteCount,
    publicSiteCount,
    trailerMaxFt: trailerMaxFt > 0 ? trailerMaxFt : null,
    trailerLenHistogram: Object.keys(hist).length ? hist : null,
    hookups,
    ampService: [...amps].sort((a, b) => a - b),
    hasFullHookup: anySewer || undefined,
    hasWaterHookup: anyWater || undefined,
    hasPullThrough,
    accessibleSiteCount,
    // facility-level amenities (reliable in the amenity map)
    dumpStation: hasAmen('Dump Station'),
    drinkingWater: hasAmen('Drinking Water') || hasAmen('Potable Water'),
    showers: hasAmen('Showers'),
    flushToilets: hasAmen('Flush Toilets'),
  };
}

// --- facility amenities accessor (shape: { campground: { amenities: {...} } })
function facilityAmenities(facJson) {
  if (!facJson) return null;
  const c = facJson.campground || facJson.facility || facJson;
  return c && c.amenities ? c.amenities : null;
}

// ---------------------------------------------------------------------------
// --verify : offline rollup of the 2 committed fixtures (no network).
// ---------------------------------------------------------------------------
function verifyFixtures() {
  const cases = [
    ['MATHER (232490)', 'recgov-campsites-mather-232490.json', 'recgov-facility-mather-232490.json'],
    ['GUNTER HILL (232593)', 'recgov-campsites-gunterhill-232593.json', 'recgov-facility-gunterhill-232593.json'],
  ];
  console.log('=== FIXTURE VERIFICATION (offline) ===\n');
  for (const [label, sf, ff] of cases) {
    const sites = JSON.parse(readFileSync(join(FIX, sf), 'utf8')).campsites;
    const amen = facilityAmenities(JSON.parse(readFileSync(join(FIX, ff), 'utf8')));
    const r = rollupCampsites(sites, amen);
    console.log(`── ${label} ──`);
    console.log(JSON.stringify(r, null, 1));
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Elevation: batch lat/lon through Open-Meteo (no key, up to 100 pts/call).
//   GET /v1/elevation?latitude=a,b,..&longitude=d,e,.. -> { elevation:[...m] }
// Cached per id so re-runs are cheap (~26 calls for 2561 pts).
// ---------------------------------------------------------------------------
const M_TO_FT = 3.280839895;
function computeElevations(records, cache) {
  const todo = records.filter((c) => c.lat != null && c.lon != null && cache[c.id] === undefined);
  if (!todo.length) { console.log(`elevation: all ${records.length} cached`); return 0; }
  console.log(`elevation: ${todo.length} to fetch in batches of 100…`);
  let done = 0;
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    const lats = batch.map((c) => c.lat).join(',');
    const lons = batch.map((c) => c.lon).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
    const res = curlJson(url, `elev-${i}`);
    if (res === 'SKIP' || res === null || !Array.isArray(res.elevation)) {
      console.warn(`  batch ${i}: elevation fetch failed, leaving uncached (will retry next run)`);
      continue;
    }
    for (let j = 0; j < batch.length; j++) {
      const m = res.elevation[j];
      cache[batch[j].id] = (typeof m === 'number') ? Math.round(m * M_TO_FT) : null;
      done++;
    }
    writeFileSync(ELEV_CKPT, JSON.stringify(cache));
    process.stdout.write(`  elevation batch ${i / 100 + 1}: +${batch.length} (total ${done})\n`);
  }
  return done;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  if (arg('verify')) { verifyFixtures(); return; }

  mkdirSync(CACHE, { recursive: true });
  const payload = JSON.parse(readFileSync(DATA, 'utf8'));
  const records = payload.campgrounds;
  const ckpt = existsSync(CKPT) ? JSON.parse(readFileSync(CKPT, 'utf8')) : {};
  const elevCache = existsSync(ELEV_CKPT) ? JSON.parse(readFileSync(ELEV_CKPT, 'utf8')) : {};

  // --- Phase B can run alone ---
  if (arg('elev-only')) {
    computeElevations(records, elevCache);
    mergeAndWrite(payload, records, ckpt, elevCache);
    return;
  }

  // --- Phase A: per-campsite enrichment (resumable) ---
  const limit = arg('limit') ? parseInt(arg('limit'), 10) : Infinity;
  const pending = records.filter((c) => ckpt[c.id] === undefined).slice(0, limit);
  console.log(`Phase A: ${pending.length} campgrounds to enrich (${Object.keys(ckpt).length} already done, ${records.length} total)`);

  let ok = 0; let unverified = 0; let skipped = 0; let i = 0;
  for (const c of pending) {
    i++;
    const sitesUrl = `https://www.recreation.gov/api/camps/campgrounds/${c.id}/campsites`;
    const facUrl = `https://www.recreation.gov/api/camps/campgrounds/${c.id}`;
    const sitesRes = curlJson(sitesUrl, `sites-${c.id}`);
    if (sitesRes === 'SKIP') { skipped++; if (i % 25 === 0) save(ckpt, elevCache); await sleep(300); continue; }
    const facRes = sitesRes === null ? null : curlJson(facUrl, `fac-${c.id}`);
    const amen = facRes && facRes !== 'SKIP' ? facilityAmenities(facRes) : null;
    const sites = sitesRes && sitesRes.campsites ? sitesRes.campsites : [];
    const roll = rollupCampsites(sites, amen);
    ckpt[c.id] = roll;
    if (roll.unverified) unverified++; else ok++;
    if (i % 20 === 0) {
      save(ckpt, elevCache);
      process.stdout.write(`  [${i}/${pending.length}] ok=${ok} unverified=${unverified} skipped=${skipped}\n`);
    }
    await sleep(300); // polite
  }
  save(ckpt, elevCache);
  console.log(`Phase A done: ok=${ok} unverified=${unverified} skipped=${skipped}`);

  // --- Phase B: elevation (only when not limiting, to avoid partial spend) ---
  if (limit === Infinity) computeElevations(records, elevCache);

  mergeAndWrite(payload, records, ckpt, elevCache);
}

function save(ckpt, elevCache) {
  writeFileSync(CKPT, JSON.stringify(ckpt));
  writeFileSync(ELEV_CKPT, JSON.stringify(elevCache));
}

// Merge checkpoint + elevation back into campgrounds.json, preserving every
// existing field + the top-level shape. Records not yet processed are left
// unchanged (honest partial enrichment; a later run completes them).
function mergeAndWrite(payload, records, ckpt, elevCache) {
  let withTrailer = 0; let withHookup = 0; let withElev = 0; let unverifiedN = 0;
  for (const c of records) {
    const r = ckpt[c.id];
    if (r) {
      if (r.unverified) {
        c.siteData = 'unverified'; // FCFS or no per-site listing — say so, don't invent
        unverifiedN++;
      } else {
        c.rvSiteCount = r.rvSiteCount;
        c.trailerMaxFt = r.trailerMaxFt != null ? r.trailerMaxFt : undefined;
        c.trailerLenHistogram = r.trailerLenHistogram || undefined;
        c.hookups = r.hookups;
        c.ampService = r.ampService && r.ampService.length ? r.ampService : undefined;
        c.hasPullThrough = r.hasPullThrough || undefined;
        c.dumpStation = r.dumpStation || undefined;
        c.drinkingWater = r.drinkingWater || undefined;
        c.showers = r.showers || undefined;
        c.flushToilets = r.flushToilets || undefined;
        c.accessibleSiteCount = r.accessibleSiteCount || undefined;
        if (r.trailerMaxFt != null) withTrailer++;
        if (r.hookups) withHookup++;
      }
    }
    const elev = elevCache[c.id];
    if (elev != null) { c.elevationFt = elev; withElev++; }
  }
  payload.stats = {
    ...payload.stats,
    withTrailerData: withTrailer,
    withHookupData: withHookup,
    withElevation: withElev,
    unverifiedSiteData: unverifiedN,
  };
  payload.enrichedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(DATA, JSON.stringify(payload));
  console.log(`\nMERGED -> src/data/campgrounds.json`);
  console.log(`  trailer data: ${withTrailer} | hookup data: ${withHookup} | elevation: ${withElev} | unverified: ${unverifiedN} | total: ${records.length}`);
}

// Only run the network/IO pipeline when invoked directly (node enrich.mjs …).
// Tests import { rollupCampsites } from this file; importing must NOT kick off a
// live run, so we guard main() behind a direct-invocation check.
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error('ENRICH FAILED:', e); process.exit(1); });
}
