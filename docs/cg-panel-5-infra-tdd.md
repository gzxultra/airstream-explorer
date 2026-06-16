# Campground Upgrade — Panel 5: China-robust Imagery/Delivery Infra + Feasibility/TDD Anchor

_Expert Agent 5 of 5. Research only — no code/data changed. Companion to panels 1–4._

This panel answers two questions the synthesis needs settled before sequencing any feature:

1. **Can we keep showing campground photos to a user in China, and how?** (imagery/delivery infra)
2. **In what order, and behind what tests, do the other panels' features actually get built in _this_ repo?** (feasibility / TDD anchor)

---

## PART 1 — IMAGERY & DELIVERY INFRA (China-robust)

### 1.1 What we have today (verified in repo)

- **Photo source.** Each slim client record ships only the photo _tail_ in field `.g` (e.g. `public/2018/08/.../232445_…_700.webp`). The client (`app.js` `hydrate()`, lines 895–899) prepends `REC_PHOTO_PREFIX = 'https://cdn.recreation.gov/'`. The detail-page server cards (`campgrounds-render.mjs` `cgCard`) emit the **already-absolute** `https://cdn.recreation.gov/...` URL directly, with `referrerpolicy="no-referrer"`.
- **Coverage.** `2460 of 2561` campgrounds (96%) carry a CDN photo URL; 101 have none (client already renders a `▲` placeholder div, not an `<img>`).
- **The CDN is exactly the kind of host the GFW throttles.** `curl -I https://cdn.recreation.gov/` confirms: `server: AmazonS3`, `via: … cloudfront.net (CloudFront)`, `x-amz-bucket-region: us-east-1`. So the photos live on **AWS CloudFront fronting an S3 bucket in us-east-1**. This is the same class of foreign-CDN dependency that already broke twice for this user: CARTO basemap tiles and Google Fonts both had to be self-hosted because they were blocked/throttled from mainland China. CloudFront edge IPs are routinely subject to packet loss / RST / SNI-based throttling across the GFW; `cdn.recreation.gov` is **not** a special-cased domain and should be assumed slow-to-dead from China.
- **Why the VM can't measure the real latency.** This build VM is not in China, so `curl` to the CDN succeeds in ~0.1–0.7s here. That tells us the asset _exists and is reachable from the open internet_; it tells us **nothing** about GFW behavior. The conclusion that it's a problem comes from (a) the host being CloudFront/S3, and (b) the documented prior breakage of CARTO + Google Fonts, not from a latency probe.

### 1.2 Image facts that constrain the fix (measured)

Probed 8 real photos + variant suffixes on one asset:

| Fact | Value | Source |
|---|---|---|
| Avg photo size | **~60 KB** (range 18–105 KB) over 8 samples | `curl size_download` |
| Format | mostly `.webp`, some `.jpg` | dataset `.g` tails |
| Variant suffix | only **`_700`** exists | `_200/_300/_400/_600` all return **HTTP 403**; only `_700.webp`/`_700.jpg` return 200 |
| Photos to host | **2460** | dataset count |

**Implication:** Recreation.gov does **not** expose a smaller thumbnail variant we can hot-link — `_700` (≈700px) is the only size that resolves. Any "ship smaller thumbnails" plan therefore requires **us** to downscale, not just request a different suffix.

Storage math for a self-hosted subset:
- As-is `_700` originals: `2460 × ~60 KB ≈ 145 MB`.
- Downscaled to a `~360px` card thumbnail (the card renders at `width=320 height=200`), re-encoded WebP q80 like the existing `transcode-images.mjs` pipeline: empirically ~12–22 KB each → **`2460 × ~18 KB ≈ 44 MB`**.
- The repo today commits its own images as the source of truth (`public/assets/img/...`, WebP). Adding ~44 MB of campground thumbnails would **roughly double-to-triple the committed image payload** and the git history weight. That is the central cost of the pure-self-host option.

### 1.3 Licensing / attribution (settled — green light)

- RIDB / Recreation.gov data is published under **Creative Commons Attribution (CC-BY)** (data.gov catalog: _"License: Creative Commons Attribution"_), and Recreation.gov's own **"Use and Share Our Data"** page states the data is free, **no need to contact them**, and asks in exchange that you _"provide a link to Recreation.gov and acknowledge credit, such as 'Data Source: Recreation.gov'."_
- The site **already does this**: every campground card links to the Recreation.gov page, and the finder + detail panels carry a "Source: Recreation.gov (RIDB)" credit line. ✅
- **What CC-BY requires if we self-host the images:** keep the attribution + link to Recreation.gov (already present) and, ideally, retain a per-photo credit. The photos come through the federal RIDB media records; treat them as CC-BY like the rest of the dataset and keep the "Data Source: Recreation.gov" credit visible wherever a photo appears. **No blocker, but the self-host path should bake a short LICENSE/attribution note into the repo (e.g. `public/assets/img/campgrounds/CREDITS.md`) so provenance travels with the bytes.**
- Caveat to record honestly: federal works are generally public-domain, but RIDB media can include agency/partner-contributed photos. CC-BY + visible "Source: Recreation.gov" link is the safe, compliant posture for both hot-proxy and self-host.

### 1.4 The image guardrail interaction (critical, repo-specific)

`build.mjs` step 7 throws the build if any **local** `<img src>` doesn't resolve on disk in `dist/`. The guardrail **explicitly skips external URLs**:

```js
if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue; // external/data URIs
```

So:
- **Today**, campground photos pass the guardrail _for free_ because they're emitted as `https://cdn.recreation.gov/...` (external → skipped). The guardrail never sees them.
- A **same-origin proxy path** like `/img/cg/<id>` is still an _external-looking absolute path off our own origin_. If emitted as `/img/...` (root-relative) it would be treated as same-origin and the guardrail would try to resolve it **on disk** and fail (there is no file — it's a Function route). **Mitigation:** either (a) keep proxied refs as absolute `https://airstream-explorer.pages.dev/img/cg/...` so the `https?://` skip applies, or (b) teach the guardrail to whitelist the `/img/cg/` Function route prefix. Option (b) is cleaner and should be a tiny, tested change.
- A **fully self-hosted** path emits real local files (`assets/img/campgrounds/<id>.webp`) → guardrail _will_ check them → this is good (it catches a missing bake) but means the **bake step must run before the guardrail**, and every record with a `.g` must have a corresponding committed file or the build fails. The 101 photoless campgrounds already render a placeholder, so the bake just needs to mirror "has photo → has file."

### 1.5 The three options, with real tradeoffs

#### Option A — Cloudflare Pages Function: same-origin proxy + cache (RECOMMENDED primary)

A Function at `/img/cg/[key].js` (or a catch-all `/img/cg/[[path]].js`) fetches the upstream `https://cdn.recreation.gov/<key>` once, stores it in the **Workers Cache API (`caches.default`)** at the edge, and serves it from our own origin (`airstream-explorer.pages.dev`) on every subsequent hit.

Why this is the right primary for a China user:
- **The browser only ever talks to our Cloudflare origin**, which already serves the HTML, CSS, JS, fonts, and basemap successfully from China (proven — those are self-hosted on this same origin). The blocked CloudFront/S3 hop moves **server-side**, Cloudflare-edge → AWS, which is not subject to the GFW. This is the same principle that fixed fonts and the basemap: _everything the client fetches comes from one origin that works._
- **Caching makes the AWS hit rare.** After the first request for a given photo populates `caches.default` at that colo, subsequent users hit cache. We set `Cache-Control: public, max-age=31536000, immutable` on the response (photos are immutable — the URL contains a content id), so both the edge cache and the browser hold it.
- **Cost fits the free plan.** Pages Functions bill as Workers requests: **100,000 requests/day on the free plan, reset midnight UTC; static-asset requests are free and unlimited.** Only the _cache-miss_ image requests invoke the Function meaningfully, and once warm they're served from cache. For a personal-scale site this is comfortably within free limits, but it IS a metered, finite resource (unlike pure static assets) — note it.

Sketch (`functions/img/cg/[[path]].js`, directory mode — the repo has no `_worker.js`, so file-based routing is the low-friction fit):

```js
// GET /img/cg/<recreation.gov key>  →  proxied + edge-cached image
const UPSTREAM = 'https://cdn.recreation.gov/';
const ALLOW = /^public\/[\w/.-]+\.(webp|jpg|jpeg|png)$/i; // only real photo tails

export const onRequestGet = async ({ params, request, waitUntil }) => {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!ALLOW.test(key)) return new Response('bad key', { status: 400 });

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), request);
  let res = await cache.match(cacheKey);
  if (res) return res;

  const upstream = await fetch(UPSTREAM + key, {
    cf: { cacheTtl: 31536000, cacheEverything: true },
  });
  if (!upstream.ok) return new Response('not found', { status: upstream.status });

  res = new Response(upstream.body, upstream);
  res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.delete('set-cookie');
  waitUntil(cache.put(cacheKey, res.clone())); // populate edge cache async
  return res;
};
```

Client/server change is tiny: swap the prefix from `https://cdn.recreation.gov/` to a same-origin `/img/cg/` in **two places** — `app.js` `REC_PHOTO_PREFIX` and `campgrounds-render.mjs` `cgCard`'s `<img src>`. Because the slim record already ships the tail in `.g`, nothing in the dataset changes.

Caveats to record:
- **`_routes.json` / invocation scoping.** Make sure only `/img/cg/*` invokes the Function; everything else stays free static. Pages auto-generates routes from the `functions/` tree, so a narrowly-named route keeps the blast radius (and the 100k/day budget) small. Verify the generated `_routes.json` includes `/img/cg/*` and excludes `/assets/*`.
- **Guardrail.** Emit proxied refs as absolute `https://…/img/cg/…` OR whitelist `/img/cg/` in the guardrail (preferred; test it).
- **Local dev.** `node scripts/serve.mjs` / the inline `npm run dev` server does NOT run Functions. Either add a tiny dev fallback that 302s `/img/cg/<key>` → the real CDN, or use `wrangler pages dev ./dist` for Function testing. Document this so a future build session doesn't think the proxy is "broken" locally.
- **No live-search dependency yet.** The same Function pattern (a `/api/search` route hitting RIDB) is what would later make _live_ campground search work from China — but that needs a RIDB API key (env secret/binding) and is a separate, larger piece. Part 1's recommendation is scoped to **images first**; live search is a documented follow-on, not part of this milestone.

#### Option B — Self-host a downscaled thumbnail subset (baked at build)

Download all 2460 `_700` photos once, downscale to ~360px WebP via the existing `transcode-images.mjs` ffmpeg path, commit to `public/assets/img/campgrounds/<id>.webp`, and emit local refs.

- **Pro:** Zero runtime dependency — same robustness as fonts/basemap, served as free unlimited static assets, no Function budget, works offline, guardrail _verifies_ every photo exists.
- **Con:** ~44 MB added to the committed repo and to every `git clone`/CI checkout; a one-time fetch script (network at author time, not build time — like `fetch-decor-images.mjs` already does); photos go **stale** (a campground that updates its photo upstream won't update here until re-baked) — but campground hero photos basically never change, so this is minor; the 101 photoless sites stay on the placeholder.
- **Repo-size is the real objection.** This user's site already carries ~22 MB of images; tripling that for campground thumbnails is a meaningful permanent weight for a feature where photos are secondary to the fit math.

#### Option C — Hybrid: proxy primary + build-time fallback subset (best resilience, more work)

Proxy (Option A) for all photos, **plus** bake a small high-value subset (e.g. the photos shown in the detail-page "top 6 that fit" previews, ~59 pages × 6 ≈ a few hundred unique) as local files. The local subset guarantees the most-seen images render even if the Function is cold/over-budget; the proxy covers the long tail in the full finder.

- **Pro:** No single point of failure; the curated previews are bulletproof; finder long-tail still works.
- **Con:** Two code paths to maintain + test; the detail-card emitter and the finder client would diverge in how they build a photo URL. More surface area than the milestone needs on day one.

### 1.6 RECOMMENDATION (Part 1)

**Primary: Option A — the Cloudflare Pages Function image proxy with `caches.default` edge caching.**

Rationale: it's the smallest change that makes photos load from the _one origin already proven to work from China_, it reuses the exact "move the blocked hop server-side" principle that fixed fonts and the basemap, it adds **zero** committed repo weight, it stays inside the free plan for a personal-scale site, and it leaves a clean path to the eventual live-search Function on the same origin. The only real risks (guardrail handling of the route, local-dev Function gap, route scoping for the request budget) are all small and testable.

**Migration path / sequencing:**
1. Add `functions/img/cg/[[path]].js` (proxy + cache, sketch above). Verify generated `_routes.json` scopes invocation to `/img/cg/*` only.
2. Whitelist `/img/cg/` in the `build.mjs` guardrail (tested change) **or** emit absolute origin URLs.
3. Flip `REC_PHOTO_PREFIX` (app.js) and the `cgCard` `<img src>` (campgrounds-render.mjs) to `/img/cg/`.
4. Add a dev fallback (302 to CDN) so `npm run dev` still shows photos without wrangler.
5. **If** real-world China testing later shows the proxy is itself being throttled (it shouldn't, since it's our origin), escalate to **Option C** by baking the curated detail-preview subset as local files — a clean additive step that needs no rework of step 1–4.

Keep the "Data Source: Recreation.gov" credit + link (already present); if/when any photos are self-hosted, add `public/assets/img/campgrounds/CREDITS.md`.

---

## PART 2 — FEASIBILITY / BUILD-ORDER + TDD ANCHOR (this repo)

### 2.1 The repo's contract (what every feature must respect)

- **Pure-fn core in `src/lib/*.mjs`, zero deps, Node built-ins only.** Logic lives in pure functions; render fns return HTML strings; `build.mjs` orchestrates. New feature logic → a new `src/lib/<feature>.mjs` of pure functions.
- **Prebuild test gate.** `package.json` `prebuild` runs `node --test test/` — **any failing test aborts the build/deploy.** This is the safety net; a feature isn't "done" until its tests are green here.
- **Validation-throws-on-bad-data.** `build.mjs` calls `validateDataset`, `validateCommunity`, `validateCampgrounds`, `validateUpgrades` and **throws** on any problem (missing source link, missing attribution, bad geo, etc.). New baked data must ship a validator that throws, so accuracy stays enforced at build time — this is the mechanism that satisfies the user's accuracy bar.
- **Content fingerprinting + immutable caching.** Step 6 hashes every asset under `assets/` (img/js/css/data) and rewrites HTML refs. **Any new client JS, CSS, or baked JSON automatically gets fingerprinted** — but the reference in HTML must use the canonical pre-hash path (e.g. `assets/data/<file>.json`) so the rewrite pass can find and swap it. Follow the `CAMP_DATA_REL` pattern exactly.
- **Image guardrail** (Part 1.4) — local `<img>` must resolve; external skipped.
- **XSS/escape discipline.** `esc()` on every data-driven string; client builds DOM with `createElement`/`textContent`, never `innerHTML`; any `application/json` data island must have `</` neutralized (`.replace(/<\//g, '<\\/')`) and be parsed back with the inverse. CSP-safe: no `eval`, no inline event handlers.
- **Client/server parity tripwire.** The off-grid estimator and the tow calculator both implement the **same math twice** (pure fn in `src/lib`, mirrored in `app.js`) and have tests asserting the two agree on representative inputs. Any new interactive calc must follow this and add a parity test, or it will silently drift.

### 2.2 Feature candidates from panels 1–4 — feasibility classification

The other panels will propose richer data fields, Airstream-fit/boondocking fusion, trip shortlist/compare, and map/detail UX. Classified by what they actually require in this repo:

| Feature class | Type | Where logic lives | Where data is baked | Blocker? |
|---|---|---|---|---|
| **Map/detail UX polish** (clustering, hover-sync, better cards, filters) | **Pure build** | `app.js` client + `campgrounds-render.mjs` | none new (uses existing slim records) | **No blocker** — pure client/render + CSS. Fastest, lowest-risk. |
| **Trip shortlist / compare** (pin campgrounds, compare side-by-side, shareable) | **Pure build** | new `src/lib/shortlist.mjs` (pure) + `app.js`; reuse `share.mjs` URL pattern | none (state in URL/localStorage like existing prefs) | **No blocker.** Mirrors existing `share.mjs` + the finder's existing "Share view" + localStorage hydrate patterns. |
| **Airstream-fit + boondocking fusion** (combine length-fit with off-grid suitability, e.g. "fits AND supports dry camping") | **Mostly pure build, light data** | new pure fn fusing `fitClass` (campgrounds.mjs) × off-grid signals; possibly extend `estimate.mjs` | **needs a per-campground "hookups/dry-camping" signal** — is it in the dataset today? | **Partial data blocker** — see 2.3. The fusion math is pure & testable; whether the _input field exists_ per campground must be checked. |
| **Richer data fields** (amenities, hookup type, season, cell coverage, elevation, reservation window) | **Data blocker** | validators + render | requires re-fetch/expansion of `campgrounds.json` from RIDB; bigger payload | **Data blocker** — needs an author-time RIDB fetch + payload-size budget. Highest effort; do last or scope tightly. |
| **Live search** (query RIDB at runtime so China users get fresh results) | **Infra + data blocker** | Pages Function (`/api/...`) + RIDB key | runtime, not baked | **Blocked on a RIDB API key (secret/env binding)** + Function budget. Separate milestone; Part 1's proxy is the prerequisite origin pattern. |

### 2.3 The one thing to verify before sequencing the fusion feature

The "Airstream-fit + boondocking fusion" idea is only as good as the per-campground attributes already in `campgrounds.json`. The slim client record (`toClientRecord`) currently ships: id, name, parent, state, org, rating, reviews, **maxLengthFt**, price-min, photo tail, lat/lon, and up to 4 activities. It does **not** ship a hookup/electric/dry-camping flag. **Action for synthesis:** before promising a boondocking-fit feature, confirm whether the _source_ `campgrounds.json` records carry an electric/hookup/`amenities` field that just isn't projected into the slim shape (cheap — projectable, pure build) versus genuinely absent (data blocker — needs a re-fetch). The fit math itself (`fits AND dry-capable`) is a trivial pure fn with full test coverage either way; the gate is the input field.

### 2.4 Recommended build order (lowest-risk → highest)

1. **Imagery proxy (Part 1, Option A).** Foundational — it's the only thing standing between the China user and the photos that every other campground feature shows. Small, testable, unblocks the visual quality of everything else. **Do first.**
2. **Map/detail UX polish.** Pure client/render/CSS, no data risk, immediate visible payoff. High value-to-risk.
3. **Trip shortlist / compare.** Pure, reuses `share.mjs` + localStorage patterns; net-new user value with no data dependency.
4. **Airstream-fit + boondocking fusion.** Pure math, but gated on the 2.3 data check. Schedule the field-existence check as its first task; if absent, demote to step 5's bucket.
5. **Richer data fields.** Author-time RIDB re-fetch + validator + payload-budget work; the only item that meaningfully grows the dataset. Scope tightly (pick the 1–2 fields that most help fit decisions) rather than importing everything.
6. **(Future milestone) Live search Function** — needs RIDB key; build on the Part 1 proxy origin pattern.

### 2.5 TDD plan per feature (concrete, mirrors existing test files)

For **every** feature, the test file lives in `test/<feature>.test.mjs` and runs under the prebuild gate. Patterns to copy:

- **Pure-fn unit tests** — like `campgrounds.test.mjs` (`fitClass`, `fitExplain`, `campgroundsForLength`): boundary cases, the "honest unknown" case (never fabricate a fit/verdict), and a property test that derived labels stay consistent with the underlying classifier (the `fitExplain.cls === fitClass(...)` pattern).
- **Render-assertion tests** — like `render.test.mjs` / `campgrounds.test.mjs` (`renderCampgroundsPage embeds…`): assert the HTML contains the mount points, the data island is **not** inlined where it shouldn't be, and the external-dataset `data-src` points at the canonical pre-fingerprint path.
- **XSS / escape tests** — copy `renderDetail escapes…` and `embeds a valid, XSS-safe JSON island`: feed `<script>`/`<img onerror>`/`</` payloads through the new render path and assert they're neutralized; for any new JSON island assert `!/<\//.test(island)`.
- **Client/server parity tripwire** — required for any new interactive calc (the fusion feature). Add a test that runs the `src/lib` pure fn and the `app.js` mirror on the same representative inputs and asserts equality, the way tow/off-grid do.
- **Fingerprint/guardrail interaction tests** — like `build-fingerprint.test.mjs`: if a feature adds a new asset kind or a Function-served image route, add a test that the guardrail's external/route skip logic behaves (especially the Part 1.4 `/img/cg/` whitelist — test that a `/img/cg/...` ref does **not** fail the guardrail, and that a genuinely missing _local_ file still does).
- **Validator-throws tests** — for any new baked field: a test that a malformed record (missing the new required field/source) makes the validator throw, preserving the accuracy contract.

### 2.6 Top build-order risk (the one to flag)

**The image guardrail + the proxy route are a silent trap.** The guardrail today gives campground photos a free pass _only because they're absolute external URLs_. The moment Part 1 flips them to a same-origin `/img/cg/...` path, the guardrail's `^(https?:)?//` skip no longer matches a root-relative ref, so the build will try to resolve a Function route as a file on disk and **fail the deploy** — or, worse, if someone "fixes" it by loosening the guardrail regex too broadly, the guardrail stops catching genuinely-missing local images (the exact broken-image bug it exists to prevent). The mitigation is precise and testable: whitelist exactly the `/img/cg/` prefix (or emit absolute origin URLs) and add a guardrail test that proves both halves — proxy refs pass, missing local files still throw. Get this wrong and either nothing deploys or the guardrail goes blind.

---

## Sources

- Recreation.gov — **Use and Share Our Data** (free, no contact needed, asks for a link + "Data Source: Recreation.gov" credit): https://www.recreation.gov/use-our-data
- RIDB on data.gov — **License: Creative Commons Attribution**: https://catalog.data.gov/dataset/recreation-information-database-ridb-58364
- RIDB API home: https://ridb.recreation.gov/
- Cloudflare Pages **Functions — Pricing** (100k req/day free, reset midnight UTC; static assets free + unlimited): https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Pages **Functions — Get started / Routing** (file-based `/functions` routing, `onRequestGet`): https://developers.cloudflare.com/pages/functions/get-started/ , https://developers.cloudflare.com/pages/functions/routing/
- Cloudflare Pages **Functions — Advanced mode** (`_worker.js`): https://developers.cloudflare.com/pages/functions/advanced-mode/
- Cloudflare Pages **Functions — CORS example** (`onRequestOptions`/`onRequest` shape): https://developers.cloudflare.com/pages/functions/examples/cors-headers/
- Cloudflare Workers **Limits — Cache API** (512 MB object, calls-per-request share subrequest quota): https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Pages **Serving Pages / caching** (immutable hashed assets, Tiered Cache): https://developers.cloudflare.com/pages/configuration/serving-pages/
- Measured in-repo: `cdn.recreation.gov` is CloudFront+S3 us-east-1 (`curl -I`); only `_700` variant resolves (others HTTP 403); avg photo ~60 KB; 2460/2561 campgrounds have a photo.
