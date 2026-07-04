import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containerStyle, KNOWN_TYPES, isKnownType } from '../src/styles.js';

test('column by default', () => {
  const s = containerStyle({});
  assert.equal(s.flexDirection, 'column');
});
test('row when row=true', () => {
  assert.equal(containerStyle({ row: true }).flexDirection, 'row');
});
test('gap passthrough (clamped non-negative)', () => {
  assert.equal(containerStyle({ props: { gap: 12 } }).gap, 12);
  assert.equal(containerStyle({ props: { gap: -5 } }).gap, 0);
  assert.equal(containerStyle({ props: { gap: 'x' } }).gap, 0);
});
test('align maps to alignItems', () => {
  assert.equal(containerStyle({ props: { align: 'center' } }).alignItems, 'center');
  assert.equal(containerStyle({ props: { align: 'end' } }).alignItems, 'flex-end');
  assert.equal(containerStyle({ props: { align: 'start' } }).alignItems, 'flex-start');
});
test('justify center/end mapping, default flex-start', () => {
  assert.equal(containerStyle({ props: { justify: 'center' } }).justifyContent, 'center');
  assert.equal(containerStyle({ props: { justify: 'end' } }).justifyContent, 'flex-end');
  assert.equal(containerStyle({ props: {} }).justifyContent, 'flex-start');
});
test('pad number applies padding', () => {
  assert.equal(containerStyle({ props: { pad: 24 } }).padding, 24);
});
test('custom style merges and wins over derived', () => {
  const s = containerStyle({ props: { pad: 10 }, style: { padding: 30, backgroundColor: '#111' } });
  assert.equal(s.padding, 30);
  assert.equal(s.backgroundColor, '#111');
});
test('wrap flag', () => {
  assert.equal(containerStyle({ props: { wrap: true } }).flexWrap, 'wrap');
  assert.equal(containerStyle({ props: {} }).flexWrap, undefined);
});
test('KNOWN_TYPES includes v0.2.0 tier-1 primitives', () => {
  for (const t of ['stack', 'row', 'card', 'divider', 'iconTile', 'text', 'button', 'image', 'spacer', 'badge', 'progressDots', 'choiceGrid']) {
    assert.ok(isKnownType(t), `missing ${t}`);
  }
  assert.equal(isKnownType('bogus'), false);
});
