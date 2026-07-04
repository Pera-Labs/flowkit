import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalWhen } from '../src/when.js';

test('evalWhen: bare truthy binding', () => {
  assert.equal(evalWhen('@isPro', { S: { isPro: true }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen('@isPro', { S: { isPro: false }, catalog: {}, rc: null }), false);
  assert.equal(evalWhen('@rc.offerings', { S: {}, catalog: {}, rc: { offerings: [1] } }), true);
  assert.equal(evalWhen('@rc.offerings', { S: {}, catalog: {}, rc: null }), false);
});

test('evalWhen: negation form !@x', () => {
  assert.equal(evalWhen('!@isPro', { S: { isPro: false }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen('!@isPro', { S: { isPro: true }, catalog: {}, rc: null }), false);
});

test('evalWhen: === literal comparison', () => {
  assert.equal(evalWhen("@isPro === false", { S: { isPro: false }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen("@isPro === false", { S: { isPro: true }, catalog: {}, rc: null }), false);
  assert.equal(evalWhen("@S.tier === 'gold'", { S: { tier: 'gold' }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen("@S.tier === 'gold'", { S: { tier: 'silver' }, catalog: {}, rc: null }), false);
});

test('evalWhen: !== literal comparison', () => {
  assert.equal(evalWhen("@S.tier !== 'gold'", { S: { tier: 'silver' }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen("@S.tier !== 'gold'", { S: { tier: 'gold' }, catalog: {}, rc: null }), false);
});

test('evalWhen: fail-open on unknown/unparseable form', () => {
  assert.equal(evalWhen('some garbage ??? expr', { S: {}, catalog: {}, rc: null }), true);
  assert.equal(evalWhen(undefined, { S: {}, catalog: {}, rc: null }), true);
  assert.equal(evalWhen(null, {}), true);
  assert.equal(evalWhen('', {}), true);
});

test('evalWhen: never throws even with malformed data', () => {
  assert.doesNotThrow(() => evalWhen('@S.x === true', null));
  assert.doesNotThrow(() => evalWhen('@S.x === true', undefined));
});

test('evalWhen: @app.* and @flag.* bindings (v0.4.0)', () => {
  const data = { S: {}, catalog: {}, rc: null, app: { buildNumber: 42, isReview: true }, flag: { hardPaywall: true } };
  assert.equal(evalWhen('@app.isReview', data), true);
  assert.equal(evalWhen('!@app.isReview', data), false);
  assert.equal(evalWhen('@flag.hardPaywall', data), true);
  assert.equal(evalWhen('@flag.missing', data), false);
});

test('evalWhen: numeric comparison operators (v0.4.0)', () => {
  const data = { S: {}, catalog: {}, rc: null, app: { buildNumber: 42 } };
  assert.equal(evalWhen('@app.buildNumber >= 42', data), true);
  assert.equal(evalWhen('@app.buildNumber >= 43', data), false);
  assert.equal(evalWhen('@app.buildNumber > 41', data), true);
  assert.equal(evalWhen('@app.buildNumber > 42', data), false);
  assert.equal(evalWhen('@app.buildNumber <= 42', data), true);
  assert.equal(evalWhen('@app.buildNumber <= 41', data), false);
  assert.equal(evalWhen('@app.buildNumber < 43', data), true);
  assert.equal(evalWhen('@app.buildNumber < 42', data), false);
});

test('evalWhen: numeric comparison fail-open when resolved/literal is not a number', () => {
  const data = { S: {}, catalog: {}, rc: null, app: { buildNumber: null } };
  assert.equal(evalWhen('@app.buildNumber >= 42', data), true); // null -> NaN -> fail open
  assert.equal(evalWhen('@app.missing >= 42', {}), true);
});

test('evalWhen: numeric comparison fail-open on empty-string/boolean resolved value (M-1)', () => {
  assert.equal(evalWhen('@S.x >= 5', { S: { x: '' }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen('@S.x >= 5', { S: { x: false }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen('@S.x >= 5', { S: { x: 'abc' }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen('@S.x >= 5', { S: { x: '7' }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen('@S.x >= 5', { S: { x: '3' }, catalog: {}, rc: null }), false);
  assert.equal(evalWhen('@S.x >= 5', { S: { x: 7 }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen('@S.x >= 5', { S: { x: 3 }, catalog: {}, rc: null }), false);
});

test('evalWhen: existing === / !== forms unaffected by new operator support', () => {
  assert.equal(evalWhen("@S.tier === 'gold'", { S: { tier: 'gold' }, catalog: {}, rc: null }), true);
});

test('evalWhen: fail-open on mismatched-quote literal', () => {
  // Opening quote is `'`, closing is `"` — not a clean matching pair.
  assert.equal(evalWhen(`@S.x === 'gold"`, { S: { x: 'gold' }, catalog: {}, rc: null }), true);
  assert.equal(evalWhen(`@S.x === 'gold"`, { S: { x: 'nope' }, catalog: {}, rc: null }), true);
});
