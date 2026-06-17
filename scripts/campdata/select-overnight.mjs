// Select the "Overnight Stays" editor's picks from the enriched campground
// dataset (src/data/campgrounds.json, 2561 Recreation.gov campgrounds). This is
// a CURATION pass, not a data dump: it produces a small, high-quality set in two
// intents and writes src/data/overnight.json.
//
//   • view    — "Big Views": no hookups, strong scenic signal (in/near a
//               National Park, or name/activities mention a view feature).
//               Park the Airstream off-grid where the window IS the view.
//   • utility — "Full Hookups": electric or full hookups, dump station, fits a
//               real trailer. Comfortable, serviced overnight stops.
//
// Every pick must clear a hard quality bar (rating, reviews, photo, RV-road
// access) and we cap per state so it isn't all Utah/Arizona. Source is the same
// public-domain Recreation.gov data already baked into the site; photos route
// through the existing same-origin /cdn/ proxy. Zero runtime deps.
//
// Usage:
//   node scripts/campdata/select-overnight.mjs            # print audit only
//   node scripts/campdata/select-overnight.mjs --write    # write overnight.json

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'src', 'data', 'campgrounds.json');
const OUT = join(HERE, '..', '..', 'src', 'data', 'overnight.json');

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const all = Array.isArray(raw) ? raw : (raw.campgrounds || Object.values(raw).find(Array.isArray));

// --- signals -------------------------------------------------------------
const VIEW_RE = /\b(view|vista|overlook|lake|canyon|mesa|ridge|river|coast|ocean|bay|beach|mountain|peak|basin|cliff|gorge|falls|summit|shore|point|dunes|desert|valley)\b/i;
const NP_RE = /national park|national monument|national seashore|national recreation|national forest|state park/i;

function rvAccessible(c) {
  const eq = (c.equipment || []).join(' ');
  const eqOk = /RV|Trailer|Fifth Wheel|Motorhome|Caravan/i.test(eq);
  const len = c.trailerMaxFt || c.maxLengthFt || 0;
  return eqOk || len >= 25;
}
function scenicSignal(c) {
  const hay = `${c.name} ${(c.activities || []).join(' ')} ${c.parent || ''}`;
  // In/near a National Park etc is the strongest "view" signal; otherwise a
  // view feature in the name or a wildlife/photography/stargazing activity.
  if (NP_RE.test(c.parent || '')) return true;
  if (VIEW_RE.test(hay)) return true;
  return /Wildlife Viewing|Photography|Star Gazing|Scenic/i.test((c.activities || []).join(' '));
}
const hk = (c) => String(c.hookups || 'none').toLowerCase();

// --- candidate pools -----------------------------------------------------
// VIEW: off-grid (no electric), scenic, genuinely good, RV-reachable.
const viewPool = all.filter((c) =>
  hk(c) === 'none' &&
  scenicSignal(c) &&
  rvAccessible(c) &&
  c.photo &&
  typeof c.lat === 'number' &&
  c.rating >= 4.5 &&
  c.reviews >= 100,
);

// UTILITY: real hookups, serviced, fits a trailer, well-reviewed.
const utilPool = all.filter((c) =>
  (hk(c) === 'electric' || hk(c) === 'full') &&
  rvAccessible(c) &&
  c.photo &&
  typeof c.lat === 'number' &&
  c.rating >= 4.5 &&
  c.reviews >= 50,
);

// --- curate: rank, cap per state, take target N -------------------------
const PER_STATE = 5;
const TARGET = 36;
// score: rating first, then a gentle log of reviews so a 4.7(2000) beats a
// 4.7(120) but a 4.9(150) still beats a 4.5(5000).
const score = (c) => c.rating * 100 + Math.log10(c.reviews + 1) * 8;

function curate(pool, lens, target) {
  const ranked = pool.slice().sort((a, b) => score(b) - score(a));
  const perState = {};
  const picks = [];
  for (const c of ranked) {
    if (picks.length >= target) break;
    const st = c.state || '?';
    if ((perState[st] || 0) >= PER_STATE) continue;
    perState[st] = (perState[st] || 0) + 1;
    picks.push(toRecord(c, lens));
  }
  return picks;
}

// Recreation.gov's max-length field is the ALL-EQUIPMENT max (a 180ft "site"
// is a pull-through that fits a tour bus, not a trailer figure). Anything over
// 45ft is meaningless to an Airstream owner and reads like a data bug on a
// card. So: keep an honest number only when it's in a believable trailer range
// (<=45ft); above that, drop the number and just flag big-rig-friendly.
function rigFit(c) {
  const raw = c.trailerMaxFt || c.maxLengthFt || 0;
  if (raw > 0 && raw <= 45) return { maxLengthFt: raw, bigRig: raw >= 30 };
  if (raw > 45) return { maxLengthFt: null, bigRig: true };   // fits big rigs, exact figure unreliable
  return { maxLengthFt: null, bigRig: false };
}

function toRecord(c, lens) {
  const fit = rigFit(c);
  return {
    id: String(c.id),
    name: c.name,
    parent: c.parent || '',
    org: c.org || '',
    state: c.state,
    city: c.city || '',
    lat: c.lat,
    lon: c.lon,
    rating: c.rating,
    reviews: c.reviews,
    price: c.price || null,
    reservable: !!c.reservable,
    maxLengthFt: fit.maxLengthFt,   // honest trailer figure, or null if unreliable
    bigRig: fit.bigRig,             // true = fits a 30ft+ rig
    hookups: hk(c),                 // none | electric | full
    dumpStation: !!c.dumpStation,
    drinkingWater: !!c.drinkingWater,
    elevationFt: c.elevationFt || null,
    activities: c.activities || [],
    photo: c.photo,
    sites: c.sites || null,
    url: c.url,
    lens,                           // view | utility
  };
}

const view = curate(viewPool, 'view', TARGET);
const utility = curate(utilPool, 'utility', TARGET);

// --- audit ---------------------------------------------------------------
function dist(picks) {
  const m = {};
  picks.forEach((p) => { m[p.state] = (m[p.state] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join('  ');
}
console.log(`VIEW pool=${viewPool.length} → picked ${view.length}`);
console.log('  states:', dist(view));
view.forEach((p) => console.log(`   • ${p.rating}★(${String(p.reviews).padStart(4)}) ${p.name}  [${p.parent}] ${p.state}${p.elevationFt ? ' '+p.elevationFt+'ft' : ''}`));
console.log(`\nUTILITY pool=${utilPool.length} → picked ${utility.length}`);
console.log('  states:', dist(utility));
utility.forEach((p) => console.log(`   • ${p.rating}★(${String(p.reviews).padStart(4)}) ${p.name}  [${p.hookups}${p.dumpStation?'+dump':''}] ${p.state} ≤${p.maxLengthFt}ft`));

if (process.argv.includes('--write')) {
  const byLens = { view: view.length, utility: utility.length };
  const data = { generatedAt: new Date().toISOString().slice(0, 10), source: 'Recreation.gov (RIDB)', byLens, stays: [...view, ...utility] };
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`\nWROTE ${OUT} — ${data.stays.length} picks (${view.length} view + ${utility.length} utility)`);
}
