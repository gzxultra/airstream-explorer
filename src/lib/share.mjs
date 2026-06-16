// Shareable campground-finder view state <-> URL hash. Pure functions so the
// round-trip is testable; src/assets/js/app.js mirrors this exactly (it can't
// import ES modules as a plain <script>).
//
// Hash shape: len, st, col (collection key), sort, q, hu (hideUnknown 0/1),
//             fo (fitsOnly 0/1), map=lat,lng,z. Defaults are omitted to keep
//             links short.

const DEFAULT_SORT = 'rank';

/** Build the hash string (no leading '#') for a finder view. */
export function encodeView(state, mapView) {
  const sp = new URLSearchParams();
  if (state.len > 0) sp.set('len', String(Math.round(state.len * 10) / 10));
  if (state.st) sp.set('st', state.st);
  if (state.collection) sp.set('col', state.collection);
  if (state.sort && state.sort !== DEFAULT_SORT) sp.set('sort', state.sort);
  if (state.q) sp.set('q', state.q);
  if (state.hideUnknown) sp.set('hu', '1');
  if (state.fitsOnly) sp.set('fo', '1');
  if (mapView && [mapView.lat, mapView.lng, mapView.z].every((n) => typeof n === 'number' && !isNaN(n))) {
    sp.set('map', `${Math.round(mapView.lat * 1e4) / 1e4},${Math.round(mapView.lng * 1e4) / 1e4},${mapView.z}`);
  }
  return sp.toString();
}

/** Parse a hash string (with or without leading '#') into a partial view. */
export function decodeView(hash) {
  const out = {};
  const h = String(hash || '').replace(/^#/, '');
  if (!h) return out;
  const sp = new URLSearchParams(h);
  if (sp.has('len')) {
    const l = parseFloat(sp.get('len'));
    out.len = (!isNaN(l) && l > 0) ? l : 0;
  }
  if (sp.has('st')) out.st = sp.get('st') || '';
  if (sp.has('col')) out.collection = sp.get('col') || '';
  if (sp.has('sort')) out.sort = sp.get('sort') || DEFAULT_SORT;
  if (sp.has('q')) out.q = (sp.get('q') || '').toLowerCase();
  if (sp.has('hu')) out.hideUnknown = sp.get('hu') === '1';
  if (sp.has('fo')) out.fitsOnly = sp.get('fo') === '1';
  const mv = sp.get('map');
  if (mv) {
    const parts = mv.split(',').map(parseFloat);
    if (parts.length === 3 && parts.every((x) => !isNaN(x))) {
      out.map = { lat: parts[0], lng: parts[1], z: Math.max(2, Math.min(18, parts[2])) };
    }
  }
  return out;
}
