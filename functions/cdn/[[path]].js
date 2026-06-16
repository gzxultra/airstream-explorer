// Same-origin image proxy for Recreation.gov campground photos.
//
// WHY: campground thumbnails live on `cdn.recreation.gov` (AWS CloudFront).
// That host is NOT reliably reachable from mainland China, where a chunk of our
// readers are — the page itself loads fine from `*.pages.dev`, but every photo
// hot-linked to the CDN silently fails, leaving broken tiles. An <img> whose
// host is blocked has no graceful fallback.
//
// FIX: serve those images from our OWN origin. `/cdn/<path>` maps 1:1 to
// `https://cdn.recreation.gov/<path>`; this Function fetches upstream at the
// Cloudflare edge (clean global egress to AWS) and streams the bytes back
// same-origin. The browser only ever talks to our domain, so a GFW block on the
// CDN host no longer matters.
//
// Read-only, GET-only passthrough of public, hot-linkable campground imagery —
// no transformation, no auth, no commercial behavior.

const UPSTREAM = 'https://cdn.recreation.gov/';

// Allowlist the path shapes Recreation.gov actually serves images under, so this
// can't be turned into an open relay for arbitrary CDN paths:
//   public/2021/08/15/.../<id>_<uuid>_700.webp   (dated uploads)
//   public/images/<id>_700.webp                  (legacy flat images)
//   webphotos/...                                 (older photo tree)
const ALLOWED = /^(public|webphotos)\/[A-Za-z0-9._\-/]+\.(webp|jpe?g|png|gif)$/i;

export async function onRequestGet(context) {
  const { params, request, waitUntil } = context;

  // [[path]] captures the rest of the URL as an array of segments.
  const segs = Array.isArray(params.path) ? params.path : [params.path];
  const path = segs.join('/');

  if (!path || path.includes('..') || !ALLOWED.test(path)) {
    return new Response('Not found', { status: 404 });
  }

  // Edge cache: keep a proxied copy so we don't re-hit CloudFront every view.
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  let upstream;
  try {
    upstream = await fetch(UPSTREAM + path, {
      headers: { accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
      // Let CF cache the upstream fetch too; these photos are effectively static.
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
  } catch (e) {
    return new Response('Upstream fetch failed', { status: 502 });
  }

  if (!upstream.ok) {
    return new Response('Upstream error', { status: upstream.status === 404 ? 404 : 502 });
  }

  // Recreation.gov's CDN serves photos as `application/octet-stream`, so we
  // can't trust the upstream content-type. We already validated the extension
  // via ALLOWED, so derive the image type from it — that's what makes the
  // browser actually render the bytes instead of offering a download.
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const ct = ext === 'webp' ? 'image/webp'
    : ext === 'png' ? 'image/png'
    : ext === 'gif' ? 'image/gif'
    : 'image/jpeg'; // jpg | jpeg

  const res = new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': ct,
      // Content-addressed (ids never change content), so cache hard.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-proxied-from': 'cdn.recreation.gov',
    },
  });

  waitUntil(cache.put(request, res.clone()));
  return res;
}
