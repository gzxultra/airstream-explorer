// Collect RV-capable campgrounds from Recreation.gov's public search API.
// Run at DEV time (node scripts/campdata/collect.mjs); output is a baked static
// JSON committed to the repo, so the live site has ZERO runtime deps and needs
// NO API key — identical philosophy to the rest of this static build.
//
// Data source: Recreation.gov (RIDB), public domain / CC-Attribution.
// We keep only campgrounds that (a) advertise RV/Trailer/Fifth-Wheel equipment,
// so the result is meaningful to an Airstream owner, and (b) have geo coordinates.
// We store the posted max trailer length when present (null = no posted limit).
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'src', 'data', 'campgrounds.json');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const BASE = 'https://www.recreation.gov/api/search';
const PAGE = 500;
const HARD_CAP = 10000; // API refuses start>=~10k

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxNum = (x) => Array.isArray(x)
  ? Math.max(0, ...x.map(Number).filter((n) => !isNaN(n)))
  : (Number(x) || 0);

const RV_RE = /RV|Trailer|Fifth/i;

// node's global fetch hangs through this VM's egress proxy (connect timeouts),
// while curl is rock-solid. So we shell out to curl per page — same reliable
// path the rest of this project uses for network I/O.
function fetchPage(start) {
  const url = `${BASE}?entity_type=campground&size=${PAGE}&start=${start}`;
  const tmp = `/tmp/camp-page-${start}.json`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const code = execFileSync('curl', [
        '-s', '--max-time', '40', '-A', UA,
        '-H', 'accept: application/json',
        '-o', tmp, '-w', '%{http_code}', url,
      ], { encoding: 'utf8' }).trim();
      if (code === '422') { rmSync(tmp, { force: true }); return null; } // past cap
      if (code !== '200') throw new Error(`HTTP ${code}`);
      const data = JSON.parse(readFileSync(tmp, 'utf8'));
      rmSync(tmp, { force: true });
      return data;
    } catch (err) {
      if (attempt === 5) { console.warn(`  page start=${start} failed: ${err.message}`); return 'SKIP'; }
    }
  }
}

function normalize(c) {
  const equip = Array.isArray(c.campsite_equipment_name) ? c.campsite_equipment_name : [];
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
    maxLengthFt: maxLen > 0 ? maxLen : null, // null = no posted limit
    equipment: equip,
    activities: acts.slice(0, 10),
    photo: c.preview_image_url || null,
    sites: Number(c.campsites_count) || null,
    url: c.id ? `https://www.recreation.gov/camping/campgrounds/${c.entity_id || c.id}` : null,
  };
}

async function main() {
  const byId = new Map();
  let start = 0;
  let pages = 0;
  while (start < HARD_CAP) {
    const data = fetchPage(start);
    if (data === null) break; // 422 past the cap
    if (data === 'SKIP') { start += PAGE; continue; } // transient failure, move on
    if (!Array.isArray(data.results) || data.results.length === 0) break;
    pages++;
    for (const c of data.results) {
      if ((c.entity_type || c.type) !== 'campground') continue;
      const equip = Array.isArray(c.campsite_equipment_name) ? c.campsite_equipment_name : [];
      if (!equip.some((e) => RV_RE.test(e))) continue; // RV-capable only
      if (!c.latitude || !c.longitude) continue; // need geo to be useful
      const n = normalize(c);
      if (n.id && n.name) byId.set(n.id, n);
    }
    process.stdout.write(`page ${pages} (start=${start}): kept ${byId.size} so far\n`);
    start += PAGE;
    await sleep(400); // be polite
  }

  const all = [...byId.values()].sort((a, b) => {
    // rank: rated+reviewed first, then by rating, then reviews
    const ra = (a.rating || 0) * Math.log10((a.reviews || 0) + 1);
    const rb = (b.rating || 0) * Math.log10((b.reviews || 0) + 1);
    return rb - ra;
  });

  const withLen = all.filter((c) => c.maxLengthFt).length;
  const withRating = all.filter((c) => c.rating).length;
  const withPhoto = all.filter((c) => c.photo).length;
  const states = new Set(all.map((c) => c.state).filter(Boolean));

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'Recreation.gov (RIDB)',
    license: 'Public data, courtesy Recreation.gov',
    count: all.length,
    stats: { withPostedLength: withLen, withRating, withPhoto, states: states.size },
    campgrounds: all,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload));
  console.log(`\nWROTE ${all.length} RV-capable campgrounds -> src/data/campgrounds.json`);
  console.log(`  posted length: ${withLen} | rated: ${withRating} | photo: ${withPhoto} | states: ${states.size}`);
}

main().catch((e) => { console.error('COLLECT FAILED:', e); process.exit(1); });
