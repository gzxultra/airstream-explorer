import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeView, decodeView } from '../src/lib/share.mjs';

test('encodeView omits defaults to keep links short', () => {
  assert.equal(encodeView({ len: 0, st: '', sort: 'rank', q: '', hideUnknown: false, fitsOnly: false }), '');
});

test('encodeView serializes a full view', () => {
  const h = encodeView(
    { len: 25, st: 'CA', sort: 'price', q: 'pines', hideUnknown: true, fitsOnly: true },
    { lat: 37.7749, lng: -119.5383, z: 8 },
  );
  const sp = new URLSearchParams(h);
  assert.equal(sp.get('len'), '25');
  assert.equal(sp.get('st'), 'CA');
  assert.equal(sp.get('sort'), 'price');
  assert.equal(sp.get('q'), 'pines');
  assert.equal(sp.get('hu'), '1');
  assert.equal(sp.get('fo'), '1');
  assert.equal(sp.get('map'), '37.7749,-119.5383,8');
});

test('decodeView round-trips an encoded view', () => {
  const state = { len: 22.5, st: 'UT', sort: 'reviews', q: 'zion', hideUnknown: false, fitsOnly: true };
  const mapView = { lat: 37.2, lng: -112.98, z: 10 };
  const decoded = decodeView('#' + encodeView(state, mapView));
  assert.equal(decoded.len, 22.5);
  assert.equal(decoded.st, 'UT');
  assert.equal(decoded.sort, 'reviews');
  assert.equal(decoded.q, 'zion');
  assert.equal(decoded.fitsOnly, true);
  // hideUnknown:false is a default, so it's omitted from the hash entirely
  // (absent = "don't override the receiver's state"), hence undefined here.
  assert.equal(decoded.hideUnknown, undefined);
  assert.deepEqual(decoded.map, { lat: 37.2, lng: -112.98, z: 10 });
});

test('decodeView is forgiving: empty, junk, and partial hashes', () => {
  assert.deepEqual(decodeView(''), {});
  assert.deepEqual(decodeView('#'), {});
  assert.deepEqual(decodeView('not=a&real=view'), {}); // no recognized keys
  const partial = decodeView('#len=30');
  assert.equal(partial.len, 30);
  assert.equal(partial.st, undefined);
});

test('decodeView clamps an out-of-range zoom and rejects a bad map triple', () => {
  assert.equal(decodeView('#map=10,20,99').map.z, 18);
  assert.equal(decodeView('#map=10,20,0').map.z, 2);
  assert.equal(decodeView('#map=10,20').map, undefined); // needs 3 parts
});

test('decodeView treats a non-positive len as "no rig"', () => {
  assert.equal(decodeView('#len=0').len, 0);
  assert.equal(decodeView('#len=-5').len, 0);
});

test('encodeView/decodeView round-trips the collection key (col)', () => {
  const h = encodeView({ len: 25, collection: 'ds', sort: 'rank' });
  const sp = new URLSearchParams(h);
  assert.equal(sp.get('col'), 'ds');
  const decoded = decodeView('#' + h);
  assert.equal(decoded.collection, 'ds');
  // omitted when empty (keeps links short)
  assert.equal(new URLSearchParams(encodeView({ collection: '' })).has('col'), false);
});
