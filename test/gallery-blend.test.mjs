// Gallery cutout-vs-photo blend treatment guard.
//
// Context: detail-page gallery cells get one of two treatments, driven by
// src/data/gallery-cutout-flags.json:
//   • is-cutout  → mix-blend-mode:darken over a warm cream gradient. Correct ONLY
//                  for studio shots on a PURE-WHITE sweep (the silver shell floats
//                  on cream; the white ground melts away).
//   • is-photo   → clean full-bleed cover on a dark #1a1a1a ground. Correct for
//                  lifestyle/interior photos AND for studio shots on a DARK
//                  background (most motorhome Sprinter/Promaster exterior renders).
//
// Bug this guards against (fixed 2026-06-20): the cutout detector sampled only
// the four corners, so motorhome exterior shots that sit on white BUT carry a
// dark reflective floor / shadow touching an edge were misclassified as cutouts.
// Under the darken blend that dark background survived as ugly black halos around
// the van. The fix re-derived flags with a border-ring darkness test, gated to
// motorhome slugs. These assertions lock in the corrected treatment so a future
// flag regeneration cannot silently reintroduce the halos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flags = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'data', 'gallery-cutout-flags.json'), 'utf8'),
);

// Dark-background motorhome studio exteriors that MUST render as photo (false),
// never cutout. slot is 1-indexed to match the on-page gallery order; the flags
// array is 0-indexed. Derived from a per-image border-ring darkness audit +
// headless-render verification (see MEMORY / commit message).
const MUST_BE_PHOTO = [
  ['interstate-24glx-2027', [1, 2, 4]],
  ['interstate-24gtx-2026', [1, 2]],
  ['interstate-19gtx-2027', [1, 2, 3]],
  ['rangeline-21pl-2027', [1, 2, 3]],
  ['rangeline-21ps-2027', [1, 2, 3]],
];

for (const [slug, slots] of MUST_BE_PHOTO) {
  test(`gallery blend: ${slug} dark-bg exteriors render as photo, not cutout`, () => {
    const arr = flags[slug];
    assert.ok(Array.isArray(arr), `missing cutout flags for ${slug}`);
    for (const slot of slots) {
      assert.equal(
        arr[slot - 1],
        false,
        `${slug} slot ${slot} must be is-photo (false) to avoid a darken-blend halo on its dark studio background`,
      );
    }
  });
}

// Trailer studio exteriors sit on pure white and look best as cutouts. Spot-check
// a few flagship floorplans so an over-aggressive regen can't downgrade the whole
// catalog to flat photo tiles (which would lose the premium "floating on cream"
// look that is the design intent).
const MUST_BE_CUTOUT = [
  ['classic-33fb-2026', 1],
  ['flying-cloud-25fb-2026', 1],
  ['caravel-22fb-2026', 1],
  ['atlas-25ms-2027', 1], // motorhome shot on WHITE → correctly stays cutout
];

for (const [slug, slot] of MUST_BE_CUTOUT) {
  test(`gallery blend: ${slug} white-bg exterior keeps cutout treatment`, () => {
    const arr = flags[slug];
    assert.ok(Array.isArray(arr), `missing cutout flags for ${slug}`);
    assert.equal(
      arr[slot - 1],
      true,
      `${slug} slot ${slot} should stay is-cutout (true) — it is a clean white-sweep studio shot`,
    );
  });
}
