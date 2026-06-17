// Basemap tile proxy contract.
//
// The Map/Satellite/Terrain switcher must serve its raster tiles same-origin
// through the /tiles/ Pages Function, NOT by hot-linking server.arcgisonline.com
// directly — that host is not reliably reachable from mainland China (same
// failure mode that killed the old CARTO basemap). These tests lock that in and
// exercise the Function's allowlist so it can't regress into an open relay.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJs = readFileSync(new URL('../src/assets/js/app.js', import.meta.url), 'utf8');

test('basemap tiles are served same-origin via /tiles/, never hot-linked to arcgisonline', () => {
  // The client must reference our own proxy paths...
  assert.ok(appJs.includes("tiles: ['/tiles/sat/{z}/{y}/{x}']"), 'satellite must use the /tiles/sat proxy');
  assert.ok(appJs.includes("tiles: ['/tiles/topo/{z}/{y}/{x}']"), 'terrain must use the /tiles/topo proxy');
  // ...and must NOT carry any raw arcgisonline tile URL into the shipped JS.
  assert.equal(
    /server\.arcgisonline\.com/.test(appJs),
    false,
    'a raw arcgisonline tile host leaked into app.js — route it through /tiles/ instead',
  );
});

// --- Exercise the Pages Function's request handling directly. -----------------
// It relies on the Workers globals `caches` and `fetch`; stub both so the logic
// (allowlist, z/y/x validation, content-type, caching) can be unit-tested.

const tileMod = await import('../functions/tiles/[[path]].js');

function makeCtx(segs, { upstreamOk = true, upstreamCt = 'image/jpeg', upstreamStatus = 200 } = {}) {
  let fetched = null;
  const ctx = {
    params: { path: segs },
    request: new Request('https://airstream-explorer.pages.dev/tiles/' + segs.join('/')),
    waitUntil() {},
  };
  globalThis.caches = { default: { async match() { return undefined; }, async put() {} } };
  globalThis.fetch = async (url) => {
    fetched = String(url);
    return {
      ok: upstreamOk,
      status: upstreamStatus,
      body: 'BYTES',
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? upstreamCt : null) },
    };
  };
  return { ctx, getFetched: () => fetched };
}

test('tile proxy: a valid satellite tile is fetched from the right Esri service and returned as an image', async () => {
  const { ctx, getFetched } = makeCtx(['sat', '4', '6', '3']);
  const res = await tileMod.onRequestGet(ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.equal(res.headers.get('x-proxied-from'), 'server.arcgisonline.com');
  assert.equal(
    getFetched(),
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/6/3',
  );
});

test('tile proxy: terrain maps to the World_Topo_Map service', async () => {
  const { ctx, getFetched } = makeCtx(['topo', '5', '12', '5']);
  const res = await tileMod.onRequestGet(ctx);
  assert.equal(res.status, 200);
  assert.equal(
    getFetched(),
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/5/12/5',
  );
});

test('tile proxy: rejects unknown basemap keys (no open relay to arbitrary services)', async () => {
  for (const bad of ['evil', 'World_Imagery', '..', 'sat2']) {
    const { ctx, getFetched } = makeCtx([bad, '4', '6', '3']);
    const res = await tileMod.onRequestGet(ctx);
    assert.equal(res.status, 404, `key "${bad}" should 404`);
    assert.equal(getFetched(), null, `key "${bad}" must not trigger an upstream fetch`);
  }
});

test('tile proxy: rejects non-integer / out-of-range z/y/x', async () => {
  const bads = [
    ['sat', 'a', '6', '3'],
    ['sat', '4', '6'],            // missing x
    ['sat', '99', '6', '3'],      // z out of range (>23)
    ['sat', '4', '6', '3.5'],
    ['sat', '4', '../6', '3'],
  ];
  for (const segs of bads) {
    const { ctx, getFetched } = makeCtx(segs);
    const res = await tileMod.onRequestGet(ctx);
    assert.equal(res.status, 404, `${segs.join('/')} should 404`);
    assert.equal(getFetched(), null, `${segs.join('/')} must not trigger an upstream fetch`);
  }
});

test('tile proxy: upstream failure surfaces as 502, missing tile as 404', async () => {
  const miss = makeCtx(['sat', '4', '6', '3'], { upstreamOk: false, upstreamStatus: 404 });
  assert.equal((await tileMod.onRequestGet(miss.ctx)).status, 404);
  const err = makeCtx(['sat', '4', '6', '3'], { upstreamOk: false, upstreamStatus: 500 });
  assert.equal((await tileMod.onRequestGet(err.ctx)).status, 502);
});
