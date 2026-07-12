import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('tow guide page', () => {
  // --- render.mjs unit tests ---
  it('renderTowGuide exports and returns valid page HTML', async () => {
    const { renderTowGuide } = await import('../src/lib/render.mjs');
    assert.equal(typeof renderTowGuide, 'function');
    const html = renderTowGuide([], []);
    assert.ok(html.includes('<!doctype html') || html.includes('<!DOCTYPE html'), 'should be a full page');
    assert.ok(html.includes('towguide-vehicles'), 'should have vehicles data island');
    assert.ok(html.includes('towguide-trailers'), 'should have trailers data island');
  });

  it('renderTowGuide embeds compact vehicle + trailer JSON', async () => {
    const { renderTowGuide } = await import('../src/lib/render.mjs');
    const { loadVehicles } = await import('../src/lib/tow.mjs');
    const { loadTrailers } = await import('../src/lib/data.mjs');
    const vehicles = loadVehicles();
    const trailers = loadTrailers();
    const html = renderTowGuide(trailers, vehicles);
    // Extract the JSON from the data islands
    const vMatch = html.match(/<script[^>]*id="towguide-vehicles"[^>]*>([^<]+)<\/script>/);
    assert.ok(vMatch, 'vehicles data island should exist');
    const vData = JSON.parse(vMatch[1].replace(/\\u003c/g, '<'));
    assert.ok(vData.length > 0, 'should have vehicles');
    assert.ok(vData[0].name, 'vehicle should have name');
    assert.ok(vData[0].maxTowLb, 'vehicle should have maxTowLb');

    const tMatch = html.match(/<script[^>]*id="towguide-trailers"[^>]*>([^<]+)<\/script>/);
    assert.ok(tMatch, 'trailers data island should exist');
    const tData = JSON.parse(tMatch[1].replace(/\\u003c/g, '<'));
    // Only 2026 trailers
    assert.ok(tData.every(t => t.year === 2026), 'should only include 2026 trailers');
  });

  it('tow guide page has correct SEO metadata', async () => {
    const { renderTowGuide } = await import('../src/lib/render.mjs');
    const html = renderTowGuide([], []);
    assert.ok(html.includes('<title>Tow Guide'), 'should have Tow Guide in title');
    assert.ok(html.includes('canonicalPath') || html.includes('towguide.html'), 'should reference towguide.html');
  });

  it('renderTowGuide has the evaluation methodology section', async () => {
    const { renderTowGuide } = await import('../src/lib/render.mjs');
    const html = renderTowGuide([], []);
    assert.ok(html.includes('How we evaluate'), 'should explain methodology');
    assert.ok(html.includes('Tow rating'), 'should mention tow rating');
    assert.ok(html.includes('Payload'), 'should mention payload');
    assert.ok(html.includes('GCWR'), 'should mention GCWR');
  });

  // --- app.js client code ---
  it('app.js contains towGuide IIFE', () => {
    const js = readFileSync(join(ROOT, 'src', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('function towGuide()'), 'should have towGuide function');
    assert.ok(js.includes('towguide-vehicles'), 'should reference vehicles data island');
    assert.ok(js.includes('towguide-results'), 'should reference results section');
  });

  // --- CSS ---
  it('site.css has tow guide styles', () => {
    const css = readFileSync(join(ROOT, 'src', 'assets', 'css', 'site.css'), 'utf8');
    assert.ok(css.includes('.towguide-pick'), 'should have towguide-pick');
    assert.ok(css.includes('.tg-vehicle-card'), 'should have vehicle card style');
    assert.ok(css.includes('.tg-comfortable'), 'should have comfortable verdict style');
    assert.ok(css.includes('.tg-tight'), 'should have tight verdict style');
    assert.ok(css.includes('.tg-over'), 'should have over verdict style');
  });

  // --- footer link ---
  it('footer includes tow guide link', () => {
    const src = readFileSync(join(ROOT, 'src', 'lib', 'render.mjs'), 'utf8');
    assert.ok(src.includes('towguide.html'), 'render.mjs should reference towguide.html in footer');
  });
});
