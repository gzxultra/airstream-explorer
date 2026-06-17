// scripts/campdata/collect-stays.mjs
// -----------------------------------------------------------------------------
// Collect "unique overnight stays" from Recreation.gov that the main RV-capable
// collector (collect.mjs) deliberately filters OUT: fire lookouts, historic
// cabins, yurts, huts, tipis, lighthouses, boat-in / hike-in sites, and
// dispersed / boondocking areas. These are the "not-a-campsite, but you can
// sleep there — often with a hell of a view" places.
//
// Same philosophy as collect.mjs / enrich.mjs:
//   - dev-time fetch via curl (node's global fetch hangs through this VM's
//     egress proxy; curl is rock-solid — project convention)
//   - resumable: every search page + every per-facility campsites response is
//     cached under .cache/stays/ so re-runs are cheap and classification can be
//     re-tuned without re-fetching
//   - baked static output -> src/data/stays.json, merged into the campground
//     dataset at build time. Zero runtime deps, no API key.
//   - source: Recreation.gov (RIDB), public domain.
//
// Classification is data-driven: we read each facility's per-CAMPSITE
// `campsite_type` (the only field that reliably distinguishes a LOOKOUT / CABIN
// / YURT from an ordinary STANDARD pad — facility_type is "STANDARD" for all of
// them). Name/description is used only where the structure type isn't encoded
// in campsite_type (lighthouses, dispersed areas).
//
// Usage:
//   node scripts/campdata/collect-stays.mjs --limit=60   # small batch, verify
//   node scripts/campdata/collect-stays.mjs              # full run
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'src', 'data', 'stays.json');
const AUDIT = '/tmp/stays-audit.json';
const CACHE = join(HERE, '.cache', 'stays');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const BASE = 'https://www.recreation.gov/api/search';
const PAGE = 200;
const MAX_PER_KW = 1200;
const CONCURRENCY = 8;

const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : 0;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxNum = (x) => Array.isArray(x)
  ? Math.max(0, ...x.map(Number).filter((n) => !isNaN(n)))
  : (Number(x) || 0);

// Keyword recall net. Deliberately broad — noise (ordinary campgrounds whose
// NAME happens to contain "cabin") is filtered out downstream by campsite_type.
const KEYWORDS = [
  'fire lookout', 'lookout tower', 'lookout',
  'cabin', 'historic cabin', 'guard station',
  'yurt', 'dome',
  'tipi', 'teepee', 'tepee',
  'hut',
  'lighthouse',
  'boat-in', 'boat in campsite',
  'hike-in', 'walk-in', 'backcountry',
  'dispersed', 'dispersed camping', 'boondock',
];

async function curlJSON(url, out) {
  if (existsSync(out)) {
    try { return JSON.parse(readFileSync(out, 'utf8')); } catch { /* refetch */ }
  }
  for (let a = 1; a <= 4; a++) {
    try {
      const { stdout } = await execFileP('curl', [
        '-s', '--max-time', '40', '-A', UA, '-H', 'accept: application/json',
        '-o', out, '-w', '%{http_code}', url,
      ], { encoding: 'utf8' });
      const code = stdout.trim();
      if (code === '200') return JSON.parse(readFileSync(out, 'utf8'));
      if (code === '404' || code === '422') return null;
      throw new Error('HTTP ' + code);
    } catch (e) {
      if (a === 4) return null;
      await sleep(500 * a);
    }
  }
  return null;
}

async function pMap(items, fn, concurrency) {
  const ret = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
      if (idx % 100 === 0) process.stdout.write(`    enriched ${idx}/${items.length}\n`);
    }
  });
  await Promise.all(workers);
  return ret;
}

async function collectCandidates() {
  const byId = new Map();
  for (const kw of KEYWORDS) {
    let start = 0;
    while (start < MAX_PER_KW) {
      const out = join(CACHE, `search-${kw.replace(/\W+/g, '_')}-${start}.json`);
      const d = await curlJSON(`${BASE}?q=${encodeURIComponent(kw)}&size=${PAGE}&start=${start}`, out);
      if (!d || !Array.isArray(d.results) || d.results.length === 0) break;
      for (const r of d.results) {
        if ((r.entity_type || r.type) !== 'campground') continue;
        if (!r.latitude || !r.longitude) continue; // need geo to map it
        const id = String(r.entity_id || r.id);
        if (!byId.has(id)) byId.set(id, r);
      }
      start += PAGE;
      if (typeof d.total === 'number' && start >= d.total) break;
    }
    console.log(`  kw "${kw}": pool now ${byId.size}`);
  }
  return [...byId.values()];
}

async function histFor(r) {
  const id = String(r.entity_id || r.id);
  const out = join(CACHE, `cs-${id}.json`);
  const d = await curlJSON(`https://www.recreation.gov/api/camps/campgrounds/${id}/campsites`, out);
  const hist = {};
  if (d && Array.isArray(d.campsites)) {
    for (const s of d.campsites) {
      const t = (s.campsite_type || '').toUpperCase() || '?';
      hist[t] = (hist[t] || 0) + 1;
    }
  }
  return hist;
}

// Priority order: most-specific / most-desirable structure wins when a facility
// mixes types. campsite_type is authoritative for built structures; name is the
// fallback (and the primary signal for lighthouses + dispersed areas, whose
// campsite_type is generic).
function classify(r, hist) {
  const name = (r.name || '').toLowerCase();
  const desc = (r.description || '').toLowerCase();
  const hasType = (re) => Object.keys(hist).some((k) => re.test(k));

  // name-primary types (campsite_type is generic STANDARD for these)
  if (/lighthouse/.test(name)) return 'lighthouse';
  if (/dispersed|boondock/.test(name)) return 'dispersed';

  // A fire lookout IS structurally a one-room cabin, so recreation.gov often
  // codes its single campsite as "CABIN …". The NAME is the honest signal for
  // what a guest is actually booking (a tower with a 360° view, not a cabin in
  // the trees), so name-as-lookout wins over the CABIN campsite_type here.
  if (/fire lookout|lookout tower|\blookout\b/.test(name)) return 'lookout';

  // campsite_type-primary types (authoritative for built structures)
  if (hasType(/LOOKOUT/)) return 'lookout';
  if (hasType(/CABIN/)) return 'cabin';
  if (hasType(/YURT/)) return 'yurt';
  if (hasType(/TE?EPEE|TIPI/)) return 'tipi';
  if (hasType(/\bHUT\b/)) return 'hut';
  if (hasType(/BOAT.?IN/)) return 'boat-in';
  if (hasType(/HIKE.?TO|WALK.?TO/)) return 'hike-in';

  // name fallback (facility whose campsites we couldn't fetch, or single-unit
  // structures that don't enumerate campsites)
  if (/fire lookout|lookout tower|\blookout\b/.test(name)) return 'lookout';
  if (/\bcabin\b|guard station/.test(name)) return 'cabin';
  if (/\byurt\b/.test(name)) return 'yurt';
  if (/teepee|tepee|tipi/.test(name)) return 'tipi';
  if (/\bhut\b/.test(name)) return 'hut';
  if (/dispersed|boondock/.test(desc)) return 'dispersed';

  return null; // ordinary campground — already in the main dataset
}

function norm(c, stayType, hist) {
  const maxLen = maxNum(c.campsite_max_vehicle_length);
  const acts = (c.activities || []).map((a) => a.activity_name || a).filter(Boolean);
  const price = c.price_range && typeof c.price_range.amount_min === 'number'
    ? { min: c.price_range.amount_min, max: c.price_range.amount_max }
    : null;
  return {
    id: String(c.entity_id || c.id),
    name: (c.name || '').replace(/\s+/g, ' ').trim(),
    parent: (c.parent_name || '').replace(/\s+/g, ' ').trim() || null,
    org: c.org_name || null,
    state: c.state_code || null,
    city: c.city || null,
    lat: c.latitude ? Number(c.latitude) : null,
    lon: c.longitude ? Number(c.longitude) : null,
    rating: c.average_rating ? Math.round(Number(c.average_rating) * 10) / 10 : null,
    reviews: c.number_of_ratings ? Number(c.number_of_ratings) : 0,
    price,
    reservable: !!c.reservable,
    maxLengthFt: maxLen > 0 ? maxLen : null,
    activities: acts.slice(0, 10),
    photo: c.preview_image_url || null,
    sites: Number(c.campsites_count) || null,
    url: `https://www.recreation.gov/camping/campgrounds/${c.entity_id || c.id}`,
    stayType,
    campsiteTypes: hist,
    description: (c.description || '').replace(/\s+/g, ' ').trim().slice(0, 800) || null,
  };
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  console.log('Stage 1: collecting candidates by keyword…');
  let cands = await collectCandidates();
  console.log(`  total unique candidates: ${cands.length}`);
  if (LIMIT) { cands = cands.slice(0, LIMIT); console.log(`  --limit: ${cands.length}`); }

  console.log(`Stage 2: fetching campsite types (concurrency ${CONCURRENCY})…`);
  const hists = await pMap(cands, histFor, CONCURRENCY);

  console.log('Stage 3: classify + build…');
  const out = [];
  const audit = {};
  for (let k = 0; k < cands.length; k++) {
    const st = classify(cands[k], hists[k]);
    if (!st) continue;
    out.push(norm(cands[k], st, hists[k]));
    (audit[st] = audit[st] || []).push({
      name: cands[k].name, state: cands[k].state_code,
      rating: cands[k].average_rating, reviews: cands[k].number_of_ratings,
      hist: hists[k],
    });
  }

  out.sort((a, b) => {
    const ra = (a.rating || 0) * Math.log10((a.reviews || 0) + 1);
    const rb = (b.rating || 0) * Math.log10((b.reviews || 0) + 1);
    return rb - ra;
  });

  const byType = {};
  for (const o of out) byType[o.stayType] = (byType[o.stayType] || 0) + 1;
  const withPhoto = out.filter((o) => o.photo).length;
  const withRating = out.filter((o) => o.rating).length;
  const states = new Set(out.map((o) => o.state).filter(Boolean));

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'Recreation.gov (RIDB)',
    license: 'Public data, courtesy Recreation.gov',
    count: out.length,
    byType,
    stats: { withPhoto, withRating, states: states.size },
    stays: out,
  };
  writeFileSync(OUT, JSON.stringify(payload));

  // audit: top 12 per type for eyeballing classification quality
  const auditOut = {};
  for (const [t, arr] of Object.entries(audit)) {
    arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    auditOut[t] = { count: arr.length, samples: arr.slice(0, 12) };
  }
  writeFileSync(AUDIT, JSON.stringify(auditOut, null, 1));

  console.log(`\nWROTE ${out.length} unique stays -> src/data/stays.json`);
  console.log('  by type:', JSON.stringify(byType));
  console.log(`  photo: ${withPhoto} | rated: ${withRating} | states: ${states.size}`);
  console.log(`  audit -> ${AUDIT}`);
}

main().catch((e) => { console.error('COLLECT-STAYS FAILED:', e); process.exit(1); });
