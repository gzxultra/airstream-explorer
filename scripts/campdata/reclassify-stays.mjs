// Reclassify stays by stayType, fixing the systematic Recreation.gov miscoding
// where fire lookouts are coded with a CABIN campsite_type. The authoritative
// signal for a lookout is the NAME ("... LOOKOUT", "Fire Lookout", "Fire Tower")
// — it beats the CABIN campsite_type. (collect-stays.mjs applies this on small
// batches but the full run shipped 34 lookouts mislabeled as cabins.)
//
// Genuine cabins/guard stations (LOUELLA CABIN, FOREST GLEN GUARD STATION,
// TIMBER BUTTE CABIN, Cold Springs Cabin, Spyglass Ground House, PADDY FLAT /
// POST CREEK GUARD STATION) have no lookout word and stay cabins. Dispersed
// sites are untouched. ONLY the stayType label changes — every factual field
// (name, photo, price, rating, coords, url) is preserved verbatim.

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', '..', 'src', 'data', 'stays.json');

// A name says "lookout" if it contains the word lookout, or "fire tower".
const LOOKOUT_RE = /\blookouts?\b|\bfire\s*tower\b/i;

export function classifyByName(name, fallback) {
  if (LOOKOUT_RE.test(name || '')) return 'lookout';
  return fallback;
}

function main() {
  const data = JSON.parse(readFileSync(FILE, 'utf8'));
  const before = {};
  const after = {};
  const changes = [];
  for (const s of data.stays) {
    before[s.stayType] = (before[s.stayType] || 0) + 1;
    const want = classifyByName(s.name, s.stayType);
    if (want !== s.stayType) {
      changes.push(`${s.stayType} -> ${want}: ${s.name}`);
      s.stayType = want;
    }
    after[s.stayType] = (after[s.stayType] || 0) + 1;
  }
  // Refresh the byType metadata block so it matches the corrected data.
  data.byType = data.stays.reduce((m, s) => {
    m[s.stayType] = (m[s.stayType] || 0) + 1;
    return m;
  }, {});
  copyFileSync(FILE, FILE + '.bak-before-reclassify');
  writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log('before:', JSON.stringify(before));
  console.log('after :', JSON.stringify(after));
  console.log(`changed ${changes.length} records:`);
  for (const c of changes) console.log('  ' + c);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
