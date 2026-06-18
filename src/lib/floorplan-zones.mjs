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

  // 27FB — same architecture as 25FB but a longer coach: front primary bed,
  // two-piece mid-ship bath (split shower + lav across the aisle), wardrobe,
  // street-side galley, rear convertible dinette + lounge. Coords read off the
  // canonical Flying Cloud 27FB diagram; this code is shared identically by
  // Flying Cloud, Globetrotter, International, Stetson 6666 and Trade Wind
  // (all five official 27FB diagrams confirmed the same skeleton). Verified
  // 2026-06-17.
  '27FB': [
    { id: 'bed', label: 'Front primary bed', x: 48, y: 22,
      blurb: 'Walk-around front queen — the fixed primary sleeping zone, ahead of the bath.' },
    { id: 'shower', label: 'Shower', x: 33, y: 35,
      blurb: 'Curb-side shower stall — the two-piece mid-ship bath splits the shower from the toilet across the aisle.' },
    { id: 'lav', label: 'Toilet & lav', x: 57, y: 36,
      blurb: 'Street-side toilet and sink, opposite the shower — a full-width wet path mid-coach.' },
    { id: 'wardrobe', label: 'Wardrobe', x: 33, y: 46,
      blurb: 'Hanging wardrobe and dresser storage between the bath and the rear lounge.' },
    { id: 'cooktop', label: 'Cooktop', x: 63, y: 50,
      blurb: 'Three-burner cooktop on the street-side galley run.' },
    { id: 'galley', label: 'Galley & sink', x: 59, y: 59,
      blurb: 'Stainless sink and counter with the fridge alongside — the kitchen core.' },
    { id: 'lounge', label: 'Rear lounge & dinette', x: 46, y: 70,
      blurb: 'Convertible booth dinette and connected lounge across the rear — folds down for guests.' },
  ],

  // 23FB — front primary bed, central living (street-side galley facing a
  // curb-side lounge), full-width rear bath. The most compact of the
  // front-bed twin-axles. Shared identically by Flying Cloud, International
  // and Trade Wind. Verified 2026-06-17.
  '23FB': [
    { id: 'bed', label: 'Front primary bed', x: 48, y: 19,
      blurb: 'Walk-around front queen at the nose of the coach.' },
    { id: 'wardrobe', label: 'Wardrobe', x: 34, y: 33,
      blurb: 'Hanging wardrobe and dresser just aft of the bed.' },
    { id: 'cooktop', label: 'Cooktop', x: 38, y: 41,
      blurb: 'Three-burner cooktop on the street-side galley run.' },
    { id: 'galley', label: 'Galley & sink', x: 41, y: 49,
      blurb: 'Stainless sink, counter and fridge — the kitchen sits opposite the lounge.' },
    { id: 'lounge', label: 'Dinette & lounge', x: 61, y: 40,
      blurb: 'Curb-side convertible dinette across the aisle from the galley — the daytime living zone.' },
    { id: 'shower', label: 'Shower', x: 40, y: 63,
      blurb: 'Full-width rear bath — shower on the curb side.' },
    { id: 'toilet', label: 'Toilet & lav', x: 55, y: 64,
      blurb: 'Toilet and vanity sink share the rear wet bath spanning the back wall.' },
  ],

  // 30RB — rear-bed layout: front lounge, mid-ship living (street-side galley
  // facing a curb-side sofa), mid-rear split bath, private rear primary bed.
  // The longest of the rear-bed twin-axles. Shared identically by Classic,
  // Globetrotter and International. Verified 2026-06-17.
  '30RB': [
    { id: 'frontlounge', label: 'Front lounge', x: 48, y: 15,
      blurb: 'Front convertible lounge / dinette — converts for extra sleeping.' },
    { id: 'sofa', label: 'Sofa', x: 37, y: 38,
      blurb: 'Curb-side sofa in the mid-ship living area, opposite the galley.' },
    { id: 'fridge', label: 'Refrigerator', x: 60, y: 34,
      blurb: 'Street-side refrigerator at the head of the galley run.' },
    { id: 'cooktop', label: 'Cooktop', x: 60, y: 42,
      blurb: 'Three-burner cooktop on the street-side galley.' },
    { id: 'galley', label: 'Galley & sink', x: 60, y: 60,
      blurb: 'Stainless sink and counter — the kitchen core ahead of the bath.' },
    { id: 'shower', label: 'Shower', x: 37, y: 57,
      blurb: 'Curb-side shower in the mid-rear bath, just ahead of the bedroom.' },
    { id: 'toilet', label: 'Toilet & lav', x: 45, y: 60,
      blurb: 'Toilet and vanity beside the shower, screening the bedroom from the living area.' },
    { id: 'bed', label: 'Rear primary bed', x: 48, y: 78,
      blurb: 'Private walk-around rear queen across the back of the coach.' },
  ],

  // 16RB — Bambi/Caravel compact single-axle: front convertible seating,
  // mid-ship galley (curb side) opposite a compact bath (street side), rear
  // bed. Shared identically by Bambi and Caravel. Verified 2026-06-17.
  '16RB': [
    { id: 'frontseat', label: 'Front convertible seat', x: 48, y: 15,
      blurb: 'Front convertible bench / dinette — folds down for extra sleeping in this compact plan.' },
    { id: 'cooktop', label: 'Cooktop', x: 38, y: 24,
      blurb: 'Two-burner cooktop on the curb-side galley.' },
    { id: 'galley', label: 'Galley & sink', x: 38, y: 33,
      blurb: 'Sink, counter and fridge — the compact kitchen run.' },
    { id: 'bath', label: 'Bathroom', x: 60, y: 32,
      blurb: 'Street-side wet bath with toilet and shower, opposite the galley.' },
    { id: 'bed', label: 'Rear bed', x: 50, y: 43,
      blurb: 'Rear bed across the back of the coach.' },
  ],

  // 20FB — Bambi/Caravel front-bed single-axle: front primary bed, mid-ship
  // living (curb-side sofa opposite the street-side galley), rear bath (street
  // side) with a curb-side dinette. Shared identically by Bambi and Caravel.
  // Verified 2026-06-17.
  '20FB': [
    { id: 'bed', label: 'Front primary bed', x: 48, y: 16,
      blurb: 'Walk-around front bed at the nose of the coach.' },
    { id: 'sofa', label: 'Sofa', x: 37, y: 35,
      blurb: 'Curb-side sofa in the mid-ship living area.' },
    { id: 'cooktop', label: 'Cooktop', x: 60, y: 24,
      blurb: 'Two-burner cooktop at the head of the street-side galley.' },
    { id: 'galley', label: 'Galley & sink', x: 60, y: 40,
      blurb: 'Sink, counter and fridge on the street-side galley run.' },
    { id: 'toilet', label: 'Toilet & lav', x: 60, y: 48,
      blurb: 'Street-side bath — toilet and vanity ahead of the shower.' },
    { id: 'shower', label: 'Shower', x: 60, y: 57,
      blurb: 'Rear corner shower on the street side.' },
    { id: 'dinette', label: 'Rear dinette', x: 38, y: 57,
      blurb: 'Curb-side rear dinette opposite the bath — converts for guest sleeping.' },
  ],

  // 22FB — Bambi/Caravel front-bed single-axle: front primary bed, mid-ship
  // galley (curb side) opposite a dinette (street side), rear bath. Shared
  // identically by Bambi and Caravel. Verified 2026-06-17.
  '22FB': [
    { id: 'bed', label: 'Front primary bed', x: 46, y: 18,
      blurb: 'Walk-around front bed at the nose of the coach.' },
    { id: 'galley', label: 'Galley & sink', x: 37, y: 32,
      blurb: 'Curb-side sink and counter — the kitchen core.' },
    { id: 'cooktop', label: 'Cooktop', x: 37, y: 41,
      blurb: 'Two-burner cooktop on the curb-side galley run.' },
    { id: 'dinette', label: 'Dinette', x: 58, y: 38,
      blurb: 'Street-side convertible dinette across from the galley.' },
    { id: 'fridge', label: 'Refrigerator & storage', x: 37, y: 54,
      blurb: 'Refrigerator and pantry storage aft of the galley.' },
    { id: 'shower', label: 'Rear bath', x: 52, y: 62,
      blurb: 'Full rear bath with toilet, vanity and shower across the back.' },
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

