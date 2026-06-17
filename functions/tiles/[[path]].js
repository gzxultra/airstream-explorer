// Same-origin proxy for the satellite / terrain basemap raster tiles.
//
// WHY: the Map/Satellite/Terrain switcher pulls raster tiles from Esri's
// `server.arcgisonline.com` (ArcGIS Online). That host is a third-party origin
// outside China and is NOT reliably reachable from the mainland, where a chunk
// of our readers (and the site's owner) are — exactly the failure mode that
// took out the old CARTO basemap and the Recreation.gov photo CDN. A WebGL map
// whose tile host is blocked just shows a blank dark canvas with no fallback.
//
// FIX: serve the tiles from our OWN origin, the same trick already proven for
// campground photos (functions/cdn/[[path]].js). `/tiles/<key>/<z>/<y>/<x>`
// maps to the matching ArcGIS MapServer tile; this Function fetches upstream at
// the Cloudflare edge (clean global egress to Esri, edge-cached) and streams
// the JPEG back same-origin. The browser only ever talks to *.pages.dev, so a
// GFW block on arcgisonline.com no longer matters, and edge caching makes
// repeat pans/zooms fast worldwide.
//
// Read-only, GET-only passthrough of public, free-with-attribution basemap
// tiles — no transformation, no auth. Attribution is preserved client-side in
// the MapLibre style (BASEMAPS[...].attribution).

// Short, allowlisted basemap keys → the exact ArcGIS service path. Keeping this
// an explicit map (not a free path passthrough) means this can NEVER be turned
// into an open relay for arbitrary arcgisonline services.
const SERVICES = {
  sat: 'World_Imagery',
  topo: 'World_Topo_Map',
};

const UPSTREAM = 'https://server.arcgisonline.com/ArcGIS/rest/services';

// z/y/x must all be plain integers (ArcGIS tile scheme). Bounds-checked so a
// junk path can't be forwarded upstream.
function validZYX(z, y, x) {
  if (![z, y, x].every((n) => /^\d{1,3}$/.test(n))) return false;
  const zi = Number(z);
  return zi >= 0 && zi <= 23;
}

export async function onRequestGet(context) {
  const { params, request, waitUntil } = context;

  // [[path]] captures the rest of the URL as an array: [key, z, y, x].
  const segs = Array.isArray(params.path) ? params.path : [params.path];
  const [key, z, y, x] = segs;

  if (!key || !SERVICES[key] || !validZYX(z, y, x)) {
    return new Response('Not found', { status: 404 });
  }

  // Edge cache: keep proxied tiles so we don't re-hit Esri on every pan/zoom.
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const url = `${UPSTREAM}/${SERVICES[key]}/MapServer/tile/${z}/${y}/${x}`;

  let upstream;
  try {
    upstream = await fetch(url, {
      headers: { accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
      // These tiles are effectively static; let CF cache the upstream fetch.
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
  } catch (e) {
    return new Response('Upstream fetch failed', { status: 502 });
  }

  if (!upstream.ok) {
    return new Response('Upstream error', { status: upstream.status === 404 ? 404 : 502 });
  }

  // ArcGIS serves these as image/jpeg; trust the upstream content-type but fall
  // back to jpeg (the documented tile format) if it's missing.
  const ct = upstream.headers.get('content-type') || 'image/jpeg';

  const res = new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': ct,
      // Tile pyramid is content-addressed by z/y/x and changes rarely; cache hard.
      'cache-control': 'public, max-age=604800',
      'x-proxied-from': 'server.arcgisonline.com',
    },
  });

  waitUntil(cache.put(request, res.clone()));
  return res;
}
