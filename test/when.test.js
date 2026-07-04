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
