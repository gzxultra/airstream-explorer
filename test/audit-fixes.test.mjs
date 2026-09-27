import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { loadTrailers } = await import('../src/lib/data.mjs');
const { loadMotorhomes } = await import('../src/lib/motorhome-data.mjs');
const { loadVehicles: loadTowVehicles } = await import('../src/lib/tow.mjs');
const { renderDetail } = await import('../src/lib/render.mjs');

const trailers = loadTrailers();
const motorhomes = loadMotorhomes();
const bySlug = (slug) => trailers.find((t) => t.slug === slug);

describe('round-2/3 audit data fixes', () => {
  it('every retained 2025 entry carries the inherited-data provenance marker', () => {
    for (const t of trailers) {
      if (t.year === 2025) {
        assert.equal(t.dataProvenance, 'inherited-2026-unverified', `${t.slug} marker`);
      } else {
        assert.ok(!t.dataProvenance, `${t.slug} must not carry the inherited marker`);
      }
    }
  });

  it('Trade Wind 23FB 2025: GVWR 6300, CCC 650 (2025 official brochure)', () => {
    const t = bySlug('trade-wind-23fb-2025');
    assert.equal(t.gvwrLb, 6300);
    assert.equal(t.cccLb, 650);
  });

  it('Trade Wind 27FB 2025 ghost entry is deleted', () => {
    assert.ok(!trailers.some((t) => t.slug === 'trade-wind-27fb-2025'), 'ghost entry gone');
    assert.equal(trailers.filter((t) => t.year === 2025).length, 27);
  });

  it('World Traveler 22RB 2026: MSRP 68300, hitch 440', () => {
    const t = bySlug('world-traveler-22rb-2026');
    assert.equal(t.msrp, 68300);
    assert.equal(t.hitchWeightLb, 440);
    // xcheck-06: interior height is a true 6'6", not a half-inch truncation
    assert.equal(t.intHeightFt, 6.5);
  });

  it('Trade Wind 25FB 2025: keeps 8.0 width with dual-source conflict note', () => {
    const t = bySlug('trade-wind-25fb-2025');
    assert.equal(t.extWidthFt, 8.0);
    assert.ok(t.specNote && t.specNote.includes("8 ft 5.5 in"), 'brochure figure cited');
    assert.ok(t.specNote.includes('airstream.com'), 'website figure cited');
  });

  it('Rangeline 21PS: sleeps 2, with pop-top note', () => {
    const m = motorhomes.find((x) => x.slug === 'rangeline-21ps-2027');
    assert.equal(m.sleeps, 2);
    assert.ok(m.sleepsNote && m.sleepsNote.includes('pop-top'), 'pop-top requirement disclosed');
  });

  it('Interstate 24GL: weight 9441, NCC 1589', () => {
    const m = motorhomes.find((x) => x.slug === 'interstate-24gl-2027');
    assert.equal(m.weightLb, 9441);
    assert.equal(m.nccLb, 1589);
  });

  it('Atlas 25RT battery stays 6.9 kWh (17.2 was the optional package)', () => {
    const m = motorhomes.find((x) => x.slug === 'atlas-25rt-2027');
    assert.equal(m.batteryKwh, 6.9);
  });

  it('tow vehicles: Ram 1500 2025 has the real 3.0L Hurricane SO I6', () => {
    const vehicles = loadTowVehicles();
    const ram = vehicles.find((v) => /ram 1500/i.test(v.name));
    assert.ok(ram, 'Ram 1500 present');
    assert.ok(!/hemi/i.test(ram.config), 'no HEMI in 2025 config');
    assert.ok(/hurricane/i.test(ram.config), 'Hurricane SO I6 config');
    assert.equal(ram.maxTowLb, 11580);
  });

  it('tow vehicles: Sierra 1500 5.3L max tow corrected to ~11000', () => {
    const vehicles = loadTowVehicles();
    const sierra = vehicles.find((v) => /sierra 1500/i.test(v.name));
    assert.equal(sierra.maxTowLb, 11000);
  });

  it('tow vehicles: Tahoe 8400 discloses the NHT Max Trailering Package requirement', () => {
    const vehicles = loadTowVehicles();
    const tahoe = vehicles.find((v) => /tahoe/i.test(v.name));
    assert.equal(tahoe.maxTowLb, 8400);
    assert.ok(/NHT Max Trailering Package/i.test(tahoe.config), 'package requirement disclosed');
  });

  it('MSRP glossary discloses the per-floorplan estimate', () => {
    const t = bySlug('bambi-16rb-2026');
    const html = renderDetail(t);
    assert.ok(html.includes('does not publish per-floorplan starting prices'), 'MSRP estimate note');
    assert.ok(html.includes('rounded to the nearest $100'), 'rounding disclosed');
  });

  it('footer no longer claims "spec-accurate … current lineup"', () => {
    const t = bySlug('bambi-16rb-2026');
    const html = renderDetail(t);
    assert.ok(!html.includes('spec-accurate field guide to the current'), 'old claim removed');
    assert.ok(html.includes('2025–2026 lineup'), 'model years stated');
    assert.ok(html.includes('2025 figures are inherited from 2026'), 'inheritance disclosed');
  });
});
