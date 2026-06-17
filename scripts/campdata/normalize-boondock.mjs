// Normalize raw OSM dispersed/boondocking nodes → Airstream Explorer boondocking schema.
// Source: OpenStreetMap (ODbL). These are first-come, first-served, UNVERIFIED community points.
// Hard rule (Ernie's accuracy bar): never invent ratings/photos/prices. Missing = null + "unverified".
import { readFileSync, writeFileSync } from 'node:fs';

const RAW = process.argv[2] || '/tmp/osm-disp.json';
const OUT = process.argv[3] || new URL('../../src/data/boondocking.json', import.meta.url).pathname;

const raw = JSON.parse(readFileSync(RAW, 'utf8')).elements || [];

// Exclude backcountry/hike-in/boat-in — Airstreams can't reach those.
const EXCLUDE = /\b(river camp|boat[- ]?in|hike[- ]?in|backpack|wilderness|trail camp|walk[- ]?in)\b/i;

// Exclude generic, identity-less names ("Dispersed Camping", "4 dispersed
// campsites") — they're real OSM points but carry no place identity, so they'd
// render as indistinguishable, low-trust cards. A boondocking card has to name
// a place a person can actually look up.
const GENERIC = /^(dispersed|camping|dispersed camping|dispersed campsites?|\d+\s+dispersed\s+campsites?|designated dispersed( camping( area)?)?)\s*$/i;

// Map OSM operator strings → clean agency label
function agency(t) {
  const o = (t.operator || t['operator:type'] || '').toLowerCase();
  if (/blm|bureau of land/.test(o)) return 'BLM';
  if (/forest|usfs/.test(o)) return 'USFS';
  if (/national park|nps/.test(o)) return 'NPS';
  if (/state/.test(o)) return 'State';
  return null;
}

// US state from rough lon/lat — only for labeling; coarse but honest
function guessState(lat, lon) {
  const B = {
    Arizona:[31.3,-114.8,37.0,-109.0], Utah:[37.0,-114.05,42.0,-109.04],
    Nevada:[35.0,-120.0,42.0,-114.0], Colorado:[37.0,-109.06,41.0,-102.04],
    'New Mexico':[31.3,-109.05,37.0,-103.0], Wyoming:[41.0,-111.06,45.0,-104.05],
    Montana:[44.3,-116.05,49.0,-104.04], Idaho:[42.0,-117.24,49.0,-111.04],
    Oregon:[42.0,-124.6,46.3,-116.46], Washington:[45.5,-124.8,49.0,-116.9],
    California:[32.5,-124.5,42.0,-114.1],
  };
  for (const [name,[s,w,n,e]] of Object.entries(B))
    if (lat>=s&&lat<=n&&lon>=w&&lon<=e) return name;
  return null;
}

function titleCase(s){return s.replace(/\w\S*/g,w=>w[0].toUpperCase()+w.slice(1).toLowerCase());}

const seen = new Set();
const out = [];
for (const e of raw) {
  const t = e.tags || {};
  let name = (t.name || '').trim();
  if (!name) continue;
  if (EXCLUDE.test(name)) continue;
  if (GENERIC.test(name.trim())) continue;
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (typeof lat!=='number' || typeof lon!=='number') continue;
  // de-dupe by rounded coords
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (seen.has(key)) continue;
  seen.add(key);

  // tidy SHOUTY / generic names
  if (name === name.toUpperCase()) name = titleCase(name);

  out.push({
    id: 'osm-' + e.id,
    name,
    agency: agency(t),                       // BLM / USFS / NPS / State / null
    state: guessState(lat, lon),
    lat: +lat.toFixed(5),
    lon: +lon.toFixed(5),
    fee: t.fee === 'no' ? 'free' : (t.fee === 'yes' ? 'fee' : 'free'), // dispersed defaults free
    reservation: 'first-come',               // dispersed is always FCFS
    hookups: 'none',                         // boondocking = dry by definition
    maxLengthFt: t.maxlength ? parseInt(t.maxlength) : null,
    capacity: t.capacity ? parseInt(t.capacity) : null,
    elevationFt: t.ele ? Math.round(+t.ele*3.281) : null,
    surface: t.surface || null,
    access: t.access || null,
    // honest gaps — these sources don't carry verified versions of these:
    rating: null,
    reviews: null,
    photo: null,
    // provenance — THIS is what keeps us honest vs the gov data
    source: 'OpenStreetMap',
    sourceLicense: 'ODbL',
    verified: false,
    osmUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
  });
}

out.sort((a,b)=> (a.state||'zz').localeCompare(b.state||'zz') || a.name.localeCompare(b.name));
const doc = {
  generatedAt: new Date().toISOString().slice(0,10),
  source: 'OpenStreetMap (ODbL)',
  note: 'First-come, first-served dispersed/boondocking sites on US public land. Community-sourced and UNVERIFIED — confirm access, road condition, and current rules before relying on any site.',
  count: out.length,
  sites: out,
};
writeFileSync(OUT, JSON.stringify(doc, null, 2));
console.log(`wrote ${out.length} boondocking sites → ${OUT}`);
console.log('agencies:', out.reduce((a,s)=>{a[s.agency||'unknown']=(a[s.agency||'unknown']||0)+1;return a;},{}));
console.log('states:', out.reduce((a,s)=>{a[s.state||'unknown']=(a[s.state||'unknown']||0)+1;return a;},{}));
