import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containerStyle, KNOWN_TYPES, isKnownType, freqChartBars, signalChainItems, buttonDims, formatVersionLabel } from '../src/styles.js';

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
test('KNOWN_TYPES includes v0.2.0 tier-2 primitives', () => {
  for (const t of ['starRating', 'coverArt', 'priceOptionList', 'freqChart', 'knobGauge']) {
    assert.ok(isKnownType(t), `missing ${t}`);
  }
});
test('KNOWN_TYPES includes v0.3.0 primitives', () => {
  assert.ok(isKnownType('signalChain'));
});
test('KNOWN_TYPES includes v0.4.0 settings primitives', () => {
  for (const t of ['settingsRow', 'versionRow', 'linkRow', 'toggleRow']) {
    assert.ok(isKnownType(t), `missing ${t}`);
  }
});

test('formatVersionLabel: version + buildNumber', () => {
  assert.equal(formatVersionLabel({ version: '1.0.9', buildNumber: 42 }), 'Version 1.0.9 (build 42)');
});
test('formatVersionLabel: buildNumber null -> version only', () => {
  assert.equal(formatVersionLabel({ version: '1.0.9', buildNumber: null }), 'Version 1.0.9');
});
test('formatVersionLabel: version missing -> null (caller renders nothing)', () => {
  assert.equal(formatVersionLabel({ version: null, buildNumber: 42 }), null);
  assert.equal(formatVersionLabel({}), null);
  assert.equal(formatVersionLabel(null), null);
});

test('freqChartBars: single series (values) sizes to height', () => {
  const r = freqChartBars({ values: [0, 5, 10], height: 100 });
  assert.equal(r.dual, false);
  assert.equal(r.bHeights, null);
  assert.equal(r.aHeights.length, 3);
  assert.equal(r.aHeights[2], 100); // max value -> full height
  assert.equal(r.aHeights[0], 2); // clamped minimum, never 0
});
test('freqChartBars: legacy `bars` alias still works', () => {
  const r = freqChartBars({ bars: [2, 4], height: 50 });
  assert.equal(r.aHeights[1], 50);
});
test('freqChartBars: dual series (a/b) shares one max scale', () => {
  const r = freqChartBars({ a: [10], b: [5], height: 100 });
  assert.equal(r.dual, true);
  assert.equal(r.aHeights[0], 100); // a is the overall max
  assert.equal(r.bHeights[0], 50); // b scaled against a's max, not its own
});
test('freqChartBars: a/b win over values/bars when both present', () => {
  const r = freqChartBars({ values: [1, 2], a: [10], b: [20] });
  assert.equal(r.aHeights.length, 1);
  assert.equal(r.dual, true);
});
test('freqChartBars: negative/non-numeric values clamp to 0, never NaN', () => {
  const r = freqChartBars({ values: [-5, 'x', 3], height: 10 });
  assert.ok(r.aHeights.every((h) => Number.isFinite(h)));
});
test('freqChartBars: empty input -> empty heights, no throw', () => {
  const r = freqChartBars({});
  assert.deepEqual(r.aHeights, []);
  assert.equal(r.dual, false);
});

test('signalChainItems: connector between every pair, none after last', () => {
  const items = signalChainItems([{ icon: 'a' }, { icon: 'b' }, { icon: 'c' }], '→');
  assert.equal(items.length, 3);
  assert.equal(items[0].connectorAfter, '→');
  assert.equal(items[1].connectorAfter, '→');
  assert.equal(items[2].connectorAfter, null);
});
test('signalChainItems: default connector arrow', () => {
  const items = signalChainItems([{ icon: 'a' }, { icon: 'b' }]);
  assert.equal(items[0].connectorAfter, '→');
});
test('signalChainItems: single node has no trailing connector', () => {
  const items = signalChainItems([{ icon: 'a' }]);
  assert.equal(items[0].connectorAfter, null);
});
test('signalChainItems: non-array input -> empty, no throw', () => {
  assert.deepEqual(signalChainItems(undefined), []);
  assert.deepEqual(signalChainItems(null), []);
});

test('buttonDims: circle variant is square with full corner radius', () => {
  const d = buttonDims('circle');
  assert.equal(d.width, d.minHeight);
  assert.equal(d.borderRadius, d.width / 2);
});
test('buttonDims: compact variant shrinks minHeight below default pill (52)', () => {
  const d = buttonDims('compact');
  assert.ok(d.minHeight < 52);
});
test('buttonDims: pill/undefined -> null (caller keeps default pill sizing)', () => {
  assert.equal(buttonDims('pill'), null);
  assert.equal(buttonDims(undefined), null);
});
