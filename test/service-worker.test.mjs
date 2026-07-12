import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

describe('service worker', () => {
  // --- source file ---
  it('sw.js source exists with placeholders', () => {
    const src = readFileSync(join(ROOT, 'src', 'assets', 'sw.js'), 'utf8');
    assert.ok(src.includes('__BUILD_VERSION__'), 'source should have build version placeholder');
    assert.ok(src.includes('__PRECACHE_MANIFEST__'), 'source should have precache manifest placeholder');
  });

  it('sw.js source handles install, activate, fetch', () => {
    const src = readFileSync(join(ROOT, 'src', 'assets', 'sw.js'), 'utf8');
    assert.ok(src.includes("addEventListener('install'"), 'should handle install');
    assert.ok(src.includes("addEventListener('activate'"), 'should handle activate');
    assert.ok(src.includes("addEventListener('fetch'"), 'should handle fetch');
  });

  it('sw.js implements cache-first for fingerprinted assets', () => {
    const src = readFileSync(join(ROOT, 'src', 'assets', 'sw.js'), 'utf8');
    assert.ok(src.includes('[0-9a-f]{8}'), 'should detect fingerprinted filenames');
    assert.ok(src.includes('caches.match'), 'should check cache');
  });

  it('sw.js falls back to offline.html for HTML requests', () => {
    const src = readFileSync(join(ROOT, 'src', 'assets', 'sw.js'), 'utf8');
    assert.ok(src.includes('/offline.html'), 'should reference offline fallback');
  });

  // --- built output ---
  it('dist/sw.js exists and has injected version (not placeholder)', () => {
    const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
    assert.ok(!sw.includes('__BUILD_VERSION__'), 'placeholder should be replaced');
    assert.ok(!sw.includes('__PRECACHE_MANIFEST__'), 'precache placeholder should be replaced');
    // Version should be an 8-char hex hash
    const vMatch = sw.match(/CACHE_VERSION = '([a-f0-9]+)'/);
    assert.ok(vMatch, 'should have a real version string');
    assert.equal(vMatch[1].length, 8, 'version should be 8 hex chars');
  });

  it('dist/sw.js precache manifest is a valid JS array of paths', () => {
    const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
    // Extract the PRECACHE array
    const pMatch = sw.match(/var PRECACHE = (\[.*?\]);/s);
    assert.ok(pMatch, 'should have PRECACHE array');
    const entries = JSON.parse(pMatch[1]);
    assert.ok(Array.isArray(entries), 'PRECACHE should be an array');
    assert.ok(entries.length > 0, 'PRECACHE should not be empty');
    // All entries should be absolute paths starting with /
    for (const e of entries) {
      assert.ok(e.startsWith('/'), `precache entry should start with /: ${e}`);
    }
    // Should include the offline fallback
    assert.ok(entries.includes('/offline.html'), 'should precache offline.html');
    // Should include fingerprinted CSS/JS (contain hash)
    const hasFingerprinted = entries.some(e => /\.[0-9a-f]{8}\./.test(e));
    assert.ok(hasFingerprinted, 'should include fingerprinted assets');
  });

  it('dist/sw.js is NOT fingerprinted (stable /sw.js path)', () => {
    assert.ok(existsSync(join(DIST, 'sw.js')), 'sw.js should exist at root');
    // Should NOT have a hash in the filename
    const files = readFileSync(join(DIST, 'sw.js'), 'utf8');
    assert.ok(files.length > 100, 'sw.js should have real content');
  });

  // --- offline.html ---
  it('dist/offline.html exists with noindex and branded content', () => {
    const html = readFileSync(join(DIST, 'offline.html'), 'utf8');
    assert.ok(html.includes('noindex'), 'offline page should be noindex');
    assert.ok(html.includes('offline') || html.includes('Offline'), 'should mention offline');
    assert.ok(html.includes('index.html'), 'should link back to home');
  });

  // --- app.js registration ---
  it('app.js registers the service worker', () => {
    const js = readFileSync(join(ROOT, 'src', 'assets', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('serviceWorker'), 'should reference serviceWorker');
    assert.ok(js.includes("register('/sw.js')"), 'should register /sw.js');
  });

  // --- sitemap exclusion ---
  it('offline.html is excluded from sitemap', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    assert.ok(!sitemap.includes('offline.html'), 'offline.html should not be in sitemap');
  });

  it('towguide.html IS in sitemap', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes('towguide.html'), 'towguide.html should be in sitemap');
  });
});
