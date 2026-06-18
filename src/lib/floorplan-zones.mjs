// src/lib/floorplan-zones.mjs
//
// Interactive floorplan annotations — the touch-friendly replacement for the
// old hover-only "hotspots" that broke on mobile. Coordinates are normalized
// PERCENTAGES (0–100) of the floorplan image box, hand-placed against the real
// official Airstream diagram and grounded with visual detection — NOT guessed.
//
// HONESTY CONTRACT: a floorplan only gets annotated once its zones have been
// verified against the actual diagram for that exact floorplan code. Anything
// not in ZONES here renders as the plain official image (no fake markers). This
// is what lets the feature scale to all 59 trailers without inventing layout.
//
// Each zone: { id, label, x, y, blurb }  where x/y is the marker centre (%).

export const FLOORPLAN_ZONES = {
  // Flying Cloud 25FB — front primary bed, two-piece mid-ship bath (split
  // shower + lav across the aisle), wardrobe, street-side galley, rear
  // convertible booth dinette + connected lounge. Verified 2026-06-17.
  '25FB': [
    { id: 'bed', label: 'Front primary bed', x: 42, y: 20,
      blurb: 'Walk-around front queen — the fixed primary sleeping zone, ahead of the bath.' },
    { id: 'shower', label: 'Shower', x: 35, y: 34,
      blurb: 'Curb-side shower stall — the "two-piece" mid-ship bath splits the shower from the toilet across the aisle.' },
    { id: 'lav', label: 'Toilet & lav', x: 57, y: 34,
      blurb: 'Street-side toilet and sink, opposite the shower — a full-width wet path mid-coach.' },
    { id: 'wardrobe', label: 'Wardrobe', x: 34, y: 43,
      blurb: 'Hanging wardrobe and dresser storage between the bath and the rear lounge.' },
    { id: 'cooktop', label: 'Cooktop', x: 63, y: 45,
      blurb: 'Three-burner cooktop on the street-side galley run.' },
    { id: 'galley', label: 'Galley & sink', x: 58, y: 54,
      blurb: 'Stainless sink and counter with the fridge alongside — the kitchen core.' },
    { id: 'lounge', label: 'Rear lounge & dinette', x: 44, y: 63,
      blurb: 'Convertible booth dinette and connected lounge across the rear — folds down for guests, which is how this plan sleeps up to six.' },
  ],
};

/** Zones for a floorplan code, or null if that plan isn't verified yet. */
export function zonesFor(floorplanCode) {
  if (!floorplanCode) return null;
  const z = FLOORPLAN_ZONES[String(floorplanCode).toUpperCase()];
  return z && z.length ? z : null;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Render the interactive overlay markup that sits on top of the floorplan
 * image. Returns '' when the plan has no verified zones (caller then shows the
 * plain image). MUST be placed INSIDE the image stage wrapper so the
 * percentage-positioned dots align to the image box only — never wrap the
 * legend in here, or the stage grows past the image and the dots drift.
 */
export function renderFloorplanZones(floorplanCode) {
  const zones = zonesFor(floorplanCode);
  if (!zones) return '';
  const markers = zones.map((z, i) => (
    `<span class="fp-marker${z.y < 28 ? ' fp-marker--below' : ''}" style="left:${z.x}%;top:${z.y}%">`
    + `<button type="button" class="fp-dot" data-fp-dot="${esc(z.id)}" `
    + `aria-label="${esc(z.label)}" aria-expanded="false" aria-controls="fp-pop-${esc(z.id)}">`
    + `<span class="fp-dot-num" aria-hidden="true">${i + 1}</span>`
    + `<span class="fp-dot-label">${esc(z.label)}</span>`
    + `</button>`
    + `<span class="fp-pop" id="fp-pop-${esc(z.id)}" role="tooltip" hidden>`
    + `<strong class="fp-pop-title">${esc(z.label)}</strong>`
    + `<span class="fp-pop-text">${esc(z.blurb)}</span></span>`
    + `</span>`
  )).join('');
  return `<div class="fp-overlay" data-fp-overlay>${markers}</div>`;
}

/**
 * Render the always-visible numbered legend below the diagram — the no-JS
 * fallback and the primary small-screen experience. Placed OUTSIDE the image
 * stage, as a sibling under the floorplan section.
 */
export function renderFloorplanLegend(floorplanCode) {
  const zones = zonesFor(floorplanCode);
  if (!zones) return '';
  const legend = zones.map((z, i) => (
    `<li class="fp-leg-item" data-fp-leg="${esc(z.id)}">`
    + `<span class="fp-leg-num">${i + 1}</span>`
    + `<span class="fp-leg-body"><strong>${esc(z.label)}</strong> — ${esc(z.blurb)}</span></li>`
  )).join('');
  return `<ol class="fp-legend" aria-label="Floor plan zones">${legend}</ol>`;
}

