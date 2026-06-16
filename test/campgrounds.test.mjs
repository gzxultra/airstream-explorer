import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitClass, canPark, campgroundsForLength, fitSummary,
  statesWithCounts, toClientRecord, orgShort, fitExplain,
} from '../src/lib/campgrounds.mjs';
import { renderCampgroundsPage } from '../src/lib/campgrounds-render.mjs';

test('fitClass: clearance, tight band, too-long, and unknown', () => {
  // 3 ft clearance rule
  assert.equal(fitClass(25, 30), 'fits');   // 30 >= 25+3
  assert.equal(fitClass(25, 28), 'fits');   // exactly clearance
  assert.equal(fitClass(25, 27), 'tight');  // between exact and clearance
  assert.equal(fitClass(25, 25), 'tight');  // exact fit = tight
  assert.equal(fitClass(25, 24), 'no');     // too long
  assert.equal(fitClass(25, null), 'unknown');
  assert.equal(fitClass(25, undefined), 'unknown');
});

test('canPark: true unless posted limit is shorter than the rig', () => {
  assert.equal(canPark(30, 40), true);
  assert.equal(canPark(30, 30), true);
  assert.equal(canPark(30, 29), false);
  assert.equal(canPark(30, null), true); // no posted limit ⇒ not excluded
});

test('campgroundsForLength filters out too-short and respects includeUnknown', () => {
  const data = [
    { id: '1', name: 'A', maxLengthFt: 40, lat: 1, lon: 1 },
    { id: '2', name: 'B', maxLengthFt: 26, lat: 1, lon: 1 }, // tight for 25
    { id: '3', name: 'C', maxLengthFt: 20, lat: 1, lon: 1 }, // too short for 25
    { id: '4', name: 'D', maxLengthFt: null, lat: 1, lon: 1 },
  ];
  const all = campgroundsForLength(data, 25);
  assert.ok(!all.find((c) => c.id === '3'), 'excludes too-short');
  assert.ok(all.find((c) => c.id === '4'), 'keeps unknown by default');
  const noUnknown = campgroundsForLength(data, 25, { includeUnknown: false });
  assert.ok(!noUnknown.find((c) => c.id === '4'), 'drops unknown when asked');
  assert.ok(all.every((c) => c.fit && c.fit !== 'no'), 'annotates fit, never "no"');
});

test('fitSummary counts add up to the dataset', () => {
  const data = [
    { maxLengthFt: 40 }, { maxLengthFt: 26 }, { maxLengthFt: 20 }, { maxLengthFt: null },
  ];
  const s = fitSummary(data, 25);
  assert.equal(s.fits + s.tight + s.no + s.unknown, data.length);
});

test('toClientRecord carries coordinates so the map can plot every site', () => {
  const c = {
    id: '232490', name: 'MATHER CAMPGROUND', parent: 'Grand Canyon National Park',
    state: 'Arizona', org: 'NPS', rating: 4.6, reviews: 6116, maxLengthFt: 30,
    price: { min: 6 }, photo: 'https://x/y.webp', url: 'https://r.gov/c/232490',
    lat: 36.04972, lon: -112.12047, activities: ['Camping', 'Biking', 'Hiking', 'Fishing', 'Boating'],
  };
  const r = toClientRecord(c);
  assert.equal(typeof r.la, 'number');
  assert.equal(typeof r.lo, 'number');
  assert.ok(Math.abs(r.la - 36.04972) < 1e-4);
  assert.ok(Math.abs(r.lo + 112.12047) < 1e-4);
  assert.equal(r.m, 30);
  assert.ok(r.a.length <= 4, 'activities trimmed to keep payload lean');
});

test('toClientRecord slims the payload: omits derivable URL, strips photo CDN prefix', () => {
  const c = {
    id: '232490', name: 'MATHER CAMPGROUND', org: 'NPS',
    photo: 'https://cdn.recreation.gov/public/2018/y.webp',
    url: 'https://www.recreation.gov/camping/campgrounds/232490',
    lat: 36, lon: -112, activities: [],
  };
  const r = toClientRecord(c);
  // The page URL is always REC_URL_PREFIX + id, so it's never shipped (client rebuilds it).
  assert.equal(r.u, undefined, 'page URL omitted — rebuilt client-side from id');
  // The photo ships WITHOUT the shared CDN prefix (client prepends it back).
  assert.equal(r.g, 'public/2018/y.webp', 'photo CDN prefix stripped');
  // A photo NOT under the known CDN is kept whole (defensive).
  const r2 = toClientRecord({ id: '1', org: 'NPS', photo: 'https://other.example/p.jpg' });
  assert.equal(r2.g, 'https://other.example/p.jpg');
});

test('orgShort normalizes long agency names', () => {
  assert.equal(orgShort('National Park Service'), 'NPS');
  assert.equal(orgShort('USDA Forest Service'), 'USFS');
});

test('statesWithCounts returns sorted, de-duped states', () => {
  const data = [
    { state: 'Utah' }, { state: 'Utah' }, { state: 'California' },
  ];
  const s = statesWithCounts(data);
  const utah = s.find((x) => x.state === 'Utah');
  assert.equal(utah.count, 2);
});

test('renderCampgroundsPage embeds coords + leaflet mount + live-fetch controls', () => {
  const campgrounds = [
    { id: '1', name: 'Mather', parent: 'Grand Canyon NP', state: 'Arizona', org: 'NPS',
      rating: 4.6, reviews: 6116, maxLengthFt: 30, price: { min: 6 },
      photo: 'https://x/y.webp', url: 'https://r.gov/c/1', lat: 36.05, lon: -112.12, activities: [] },
  ];
  const trailers = [
    { slug: 'bambi-16rb-2026', model: 'Bambi', floorplan: '16RB', lengthFt: 16.3, year: 2026 },
    { slug: 'classic-33fb-2026', model: 'Classic', floorplan: '33FB', lengthFt: 33.0, year: 2026 },
  ];
  const { body, payload } = renderCampgroundsPage(campgrounds, trailers);
  assert.ok(body.includes('id="cg-map"'), 'has map mount');
  assert.ok(body.includes('id="cg-data"'), 'has data mount');
  assert.ok(body.includes('id="cg-rig"'), 'has rig picker');
  // rig options expose real lengths
  assert.ok(body.includes('16RB') && body.includes('33FB'));
  // The dataset is NO LONGER inlined — it ships as an external, cache-forever
  // file. The page only carries a data-src pointer; the payload is returned
  // separately for build.mjs to write out and fingerprint.
  assert.ok(!/<script type="application\/json" id="cg-data">/.test(body), 'dataset is NOT inlined into the HTML');
  assert.ok(/id="cg-data"[^>]*data-src="assets\/data\/campgrounds\.json"/.test(body), 'page points at the external dataset');
  assert.ok(payload && Array.isArray(payload.campgrounds), 'payload returned for external write');
  assert.equal(payload.campgrounds.length, 1);
  assert.equal(typeof payload.campgrounds[0].la, 'number');
  assert.equal(typeof payload.campgrounds[0].lo, 'number');
  // slimming: the page URL is omitted (rebuilt client-side from id), and the
  // photo ships without its shared CDN prefix.
  assert.equal(payload.campgrounds[0].u, undefined, 'page URL omitted from payload');
});

test('fitExplain: verdict, confidence, and the arithmetic in the "why"', () => {
  // Comfortable fit: shows feet-to-spare and references the 3' buffer.
  const fits = fitExplain(25, 30);
  assert.equal(fits.cls, 'fits');
  assert.equal(fits.conf, 'posted');
  assert.match(fits.why, /30′ max/);
  assert.match(fits.why, /your 25′/);
  assert.match(fits.why, /5′ to spare/);

  // Tight band: under the buffer, tells the user to verify the exact site.
  const tight = fitExplain(25, 27);
  assert.equal(tight.cls, 'tight');
  assert.equal(tight.conf, 'posted');
  assert.match(tight.why, /just 2′/);
  assert.match(tight.why, /verify/i);

  // Too long: states the overage explicitly.
  const no = fitExplain(30, 24);
  assert.equal(no.cls, 'no');
  assert.match(no.why, /6′ over/);
});

test('fitExplain: no posted limit is honestly "unverified", never a fabricated fit', () => {
  const unknown = fitExplain(25, null);
  assert.equal(unknown.cls, 'unknown');
  assert.equal(unknown.conf, 'unverified');
  assert.equal(unknown.label, 'Fit unverified');
  assert.match(unknown.why, /can’t be confirmed/);
  // Never claims it fits.
  assert.doesNotMatch(unknown.why, /to spare|fits/i);
});

test('fitExplain: no rig chosen reports the posted limit, with no "why"', () => {
  const posted = fitExplain(0, 30);
  assert.equal(posted.cls, 'limit');
  assert.equal(posted.label, 'Up to 30′');
  assert.equal(posted.why, '');

  const nolimit = fitExplain(0, null);
  assert.equal(nolimit.cls, 'unknown');
  assert.equal(nolimit.conf, 'unverified');
  assert.equal(nolimit.why, '');
});

test('fitExplain labels/classes stay consistent with fitClass', () => {
  for (const [len, max] of [[25, 30], [25, 27], [25, 25], [30, 24]]) {
    assert.equal(fitExplain(len, max).cls, fitClass(len, max));
  }
});

// ---------------------------------------------------------------------------
// Enriched toClientRecord fields (the new per-site intelligence payload)
// ---------------------------------------------------------------------------
test('toClientRecord ships the enriched per-site fields with slim keys', () => {
  const c = {
    id: '232490', name: 'MATHER CAMPGROUND', state: 'Arizona', org: 'NPS',
    lat: 36.05, lon: -112.12, activities: [],
    maxLengthFt: 30, trailerMaxFt: 30,
    trailerLenHistogram: { 15: 44, 16: 4, 21: 6, 25: 23, 27: 37, 30: 22 },
    hookups: 'none', ampService: [], hasPullThrough: true, elevationFt: 6991,
    rvSiteCount: 136, dumpStation: true, flushToilets: true, accessibleSiteCount: 8,
  };
  const r = toClientRecord(c);
  assert.deepEqual(r.th, { 15: 44, 16: 4, 21: 6, 25: 23, 27: 37, 30: 22 }, 'histogram shipped under .th');
  assert.equal(r.tm, 30, 'trailer-true max under .tm');
  assert.equal(r.h, 'none', 'hookups under .h');
  assert.equal(r.am, undefined, 'empty ampService omitted');
  assert.equal(r.pt, 1, 'pull-through flag');
  assert.equal(r.el, 6991, 'elevation under .el');
  assert.equal(r.rc, 136, 'rv site count');
  assert.equal(r.ds, 1, 'dump station');
  assert.equal(r.fl, 1, 'flush toilets');
  assert.equal(r.ac, 8, 'accessible site count');
  assert.equal(r.dw, undefined, 'absent facility omitted (no drinking water field)');
  assert.equal(r.sh, undefined, 'absent facility omitted (no showers field)');
});

test('toClientRecord keeps amp service (30/50 subset) and the unverified flag honest', () => {
  const full = toClientRecord({
    id: '1', name: 'Big', lat: 1, lon: 1, activities: [],
    hookups: 'full', ampService: [20, 30, 50], trailerLenHistogram: { 50: 2 }, trailerMaxFt: 50,
  });
  assert.deepEqual(full.am, [30, 50], 'only the meaningful 30/50 amps survive');

  const unver = toClientRecord({ id: '2', name: 'Unknown', lat: 1, lon: 1, activities: [], siteData: 'unverified' });
  assert.equal(unver.uv, 1, 'unverified parks carry the honest-missing flag');
  assert.equal(unver.th, undefined, 'no histogram → omitted, never zeroed');
  assert.equal(unver.tm, undefined);
  assert.equal(unver.h, undefined);
});

// ---------------------------------------------------------------------------
// Finder filter controls (hookup / pull-through / elevation)
// ---------------------------------------------------------------------------
test('renderCampgroundsPage server-renders the new hookup/elevation/pull-through controls', () => {
  const campgrounds = [
    { id: '1', name: 'Mather', state: 'Arizona', org: 'NPS', lat: 36, lon: -112, activities: [],
      maxLengthFt: 30, trailerLenHistogram: { 25: 10 }, hookups: 'none', elevationFt: 6991, hasPullThrough: true },
  ];
  const trailers = [{ slug: 'classic-33fb-2026', model: 'Classic', floorplan: '33FB', lengthFt: 33.25, year: 2026 }];
  const { body } = renderCampgroundsPage(campgrounds, trailers);
  assert.ok(body.includes('id="cg-hookup"'), 'hookup filter present');
  assert.ok(body.includes('id="cg-elev"'), 'elevation filter present');
  assert.ok(body.includes('id="cg-pullthrough"'), 'pull-through toggle present');
  // hookup options
  assert.match(body, /id="cg-hookup"[\s\S]*?Electric or better[\s\S]*?Full hookups[\s\S]*?Dry camping/);
  // elevation bands from ELEVATION_BANDS
  assert.match(body, /Low \(under 2,000/);
  assert.match(body, /High \(8,000/);
});

test('renderCampgroundsPage server-renders the curated collections rail with honest counts', () => {
  const campgrounds = [
    // editor's pick + alpine
    { id: '1', name: 'High Star', state: 'Colorado', org: 'NPS', parent: 'Rocky Mountain National Park',
      lat: 40, lon: -105, activities: ['Star Gazing'], rating: 4.8, reviews: 500, elevationFt: 8200,
      maxLengthFt: 30, hookups: 'none', price: { min: 30, max: 30 }, reservable: true },
    // army corps lakeside, full hookups
    { id: '2', name: 'Lakeview', state: 'Texas', org: 'US Army Corps of Engineers', parent: 'Some Lake',
      lat: 31, lon: -97, activities: ['Boating'], rating: 4.2, reviews: 40, elevationFt: 600,
      maxLengthFt: 40, hookups: 'full', price: { min: 24, max: 24 }, reservable: true },
  ];
  const trailers = [{ slug: 'classic-33fb-2026', model: 'Classic', floorplan: '33FB', lengthFt: 33.25, year: 2026 }];
  const { body, payload } = renderCampgroundsPage(campgrounds, trailers);
  assert.ok(body.includes('class="cg-collections"'), 'collections rail present');
  assert.ok(body.includes('data-col="ed"'), 'Editor\'s Picks chip present');
  assert.ok(body.includes('data-col="al"'), 'Alpine chip present');
  assert.ok(body.includes('data-col="lk"'), 'Lakeside chip present');
  assert.ok(body.includes('cg-col-all'), 'All campgrounds chip present');
  // honest counts baked into the payload + reflected in chip labels
  assert.equal(payload.collections.ed, 1, 'one editor pick');
  assert.equal(payload.collections.al, 1, 'one alpine');
  assert.equal(payload.collections.lk, 1, 'one lakeside');
  assert.equal(payload.collections.fh, 1, 'one full-hookup');
  assert.equal(payload.collections.ds, 1, 'one dark-sky');
  assert.equal(payload.collections.np, 1, 'one inside-a-NP');
  // the baked client records carry membership for the filter
  const c1 = payload.campgrounds.find((c) => c.i === '1');
  assert.ok(c1.cl.includes('ed') && c1.cl.includes('al') && c1.cl.includes('ds') && c1.cl.includes('np'));
});
