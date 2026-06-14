// Extract official Airstream interior décor options from saved official product
// pages' embedded __NUXT_DATA__, map to our family slugs, emit
// src/data/decor-options.json as a clean MATERIAL PALETTE per scheme.
//
// Airstream publishes each décor scheme as a set of coordinating material
// swatches: a cabinetry/wood finish (swatchImageLeft), seating upholstery
// (swatchImageRight), plus countertop / flooring / bedding (prioritySwatches).
// We surface them as labeled swatches — honest to the source, no invented data.
import fs from 'node:fs';
import path from 'node:path';

const OFFICIAL_DIR = process.argv[2] || '/tmp/airstream-official';
const OUT = path.resolve('src/data/decor-options.json');

const FILE_TO_FAMILY = {
  bambi: 'bambi', basecamp: 'basecamp', 'basecamp-xe': 'basecamp-xe',
  caravel: 'caravel', classic: 'classic', flw: 'frank-lloyd-wright-limited-edition',
  'flying-cloud': 'flying-cloud', globetrotter: 'globetrotter',
  international: 'international', stetson: 'stetson-6666-special-edition',
  'trade-wind': 'trade-wind', 'world-traveler': 'world-traveler',
};

function decodeNuxt(file) {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  const arr = JSON.parse(m[1]);
  const seen = new Map();
  function D(i, d = 0) {
    if (typeof i !== 'number') return i;
    if (i < 0 || i >= arr.length || d > 90) return null;
    if (seen.has(i)) return seen.get(i);
    const v = arr[i];
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) { const o = []; seen.set(i, o); for (const e of v) o.push(D(e, d + 1)); return o; }
    const o = {}; seen.set(i, o); for (const k in v) o[k] = D(v[k], d + 1); return o;
  }
  return D(0);
}

function findDecor(root) {
  let decor = null;
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.decorOptions && Array.isArray(n.decorOptions) && n.decorOptions.length && !decor) decor = n.decorOptions;
    for (const k in n) walk(n[k]);
  })(root);
  return decor || [];
}

// Classify a swatch by its source filename into a material label. Match by the
// material SUFFIX first (most reliable — e.g. "...-countertop.jpg"); wood-species
// words are only a last-resort cabinetry hint so a color prefix like
// "sunlit-maple-bedspread" isn't misfiled as cabinetry.
function kindOf(url) {
  const f = (url.split('/').pop() || '').toLowerCase().replace(/\.[a-z0-9]+$/, '');
  if (/bed-?spread|bedding|duvet/.test(f)) return 'Bedding';
  if (/countertop|counter|corian|surface/.test(f)) return 'Countertop';
  if (/floor/.test(f)) return 'Flooring';
  if (/seat|sofa|slip-?cover|ultraleather|leather|fabric|upholst|performatex/.test(f)) return 'Upholstery';
  if (/accent-?pillow|pillow/.test(f)) return 'Accent pillow';
  if (/curtain|drape|shade|window/.test(f)) return 'Window covering';
  if (/backsplash|tile/.test(f)) return 'Backsplash';
  if (/accent-wall|accentwall|-accent$/.test(f)) return 'Interior';
  if (/awning/.test(f)) return 'Awning';
  if (/cargo|bars/.test(f)) return 'Cargo';
  if (/laminate|cabinet|veneer/.test(f)) return 'Cabinetry';
  if (/galley|kitchen/.test(f)) return 'Galley';
  // last-resort: a wood-species word usually denotes the cabinetry finish
  if (/\b(elm|walnut|maple|oak|beech)\b/.test(f)) return 'Cabinetry';
  return 'Material';
}

// Preferred display order of material kinds in the palette.
const ORDER = ['Cabinetry', 'Interior', 'Upholstery', 'Countertop', 'Flooring', 'Bedding', 'Backsplash', 'Window covering', 'Accent pillow', 'Galley', 'Awning', 'Cargo', 'Material'];

const out = {};
let total = 0, totalSwatches = 0;
for (const [fileBase, family] of Object.entries(FILE_TO_FAMILY)) {
  const file = path.join(OFFICIAL_DIR, fileBase + '.html');
  if (!fs.existsSync(file)) { console.warn('MISSING', file); continue; }
  const decor = findDecor(decodeNuxt(file));
  const byName = new Map();
  for (const d of decor) {
    const name = (d.decorName || '').trim();
    if (!name || byName.has(name)) continue;
    // Gather candidate material URLs in priority order, dedupe, classify,
    // keep one swatch per kind.
    const candidates = [
      d.swatchImageLeft,             // cabinetry / wood finish (or accent wall)
      d.swatchImageRight,            // seating upholstery
      ...(d.prioritySwatches || []), // countertop / flooring / bedding / seating
      ...(d.allSwatches || []),
    ].filter(Boolean);
    const perKind = new Map();
    const seenUrl = new Set();
    for (const url of candidates) {
      if (seenUrl.has(url)) continue;
      seenUrl.add(url);
      const kind = kindOf(url);
      if (!perKind.has(kind)) perKind.set(kind, url);
    }
    const swatches = [...perKind.entries()]
      .sort((a, b) => (ORDER.indexOf(a[0]) + 1 || 99) - (ORDER.indexOf(b[0]) + 1 || 99))
      .map(([kind, url]) => ({ kind, url }));
    byName.set(name, { name, description: (d.description || '').trim(), swatches });
    totalSwatches += swatches.length;
  }
  const schemes = [...byName.values()];
  if (schemes.length) { out[family] = schemes; total += schemes.length; }
  console.log(family.padEnd(36), schemes.length, 'schemes,', schemes.reduce((s, x) => s + x.swatches.length, 0), 'swatches');
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`\nWrote ${OUT} — ${Object.keys(out).length} families, ${total} schemes, ${totalSwatches} swatches`);
