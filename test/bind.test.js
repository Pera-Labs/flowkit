import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveData, getPath } from '../src/bind.js';

test('getPath: resolves dotted path through objects and array indices', () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }] } };
  assert.equal(getPath(obj, 'a.b.0.c'), 1);
  assert.equal(getPath(obj, 'a.b.1.c'), 2);
});

test('getPath: missing path returns undefined, never throws', () => {
  assert.equal(getPath({}, 'a.b.c'), undefined);
  assert.equal(getPath(null, 'a.b'), undefined);
  assert.equal(getPath(undefined, 'a'), undefined);
});

test('resolveData: @S.<path> resolves from data.S', () => {
  const data = { S: { guitar: 'Strat' }, catalog: {}, rc: null };
  assert.equal(resolveData('@S.guitar', data), 'Strat');
});

test('resolveData: @catalog.<name> resolves from data.catalog', () => {
  const data = { S: {}, catalog: { GUITARS: ['Strat', 'Les Paul'] }, rc: null };
  assert.deepEqual(resolveData('@catalog.GUITARS', data), ['Strat', 'Les Paul']);
});

test('resolveData: @rc.<path> resolves from data.rc', () => {
  const data = { S: {}, catalog: {}, rc: { offerings: [{ id: 'p1' }], selectedPackageId: 'p1' } };
  assert.equal(resolveData('@rc.selectedPackageId', data), 'p1');
  assert.deepEqual(resolveData('@rc.offerings.0', data), { id: 'p1' });
});

test('resolveData: @app.<path> resolves from data.app (v0.4.0)', () => {
  const data = { S: {}, catalog: {}, rc: null, app: { version: '1.2.3', buildNumber: 42 } };
  assert.equal(resolveData('@app.version', data), '1.2.3');
  assert.equal(resolveData('@app.buildNumber', data), 42);
});

test('resolveData: @flag.<path> resolves from data.flag (v0.4.0)', () => {
  const data = { S: {}, catalog: {}, rc: null, flag: { hardPaywall: true } };
  assert.equal(resolveData('@flag.hardPaywall', data), true);
});

test('resolveData: unknown prefix passes through unchanged', () => {
  const data = { S: {}, catalog: {}, rc: null };
  assert.equal(resolveData('@weird.thing', data), '@weird.thing');
});

test('resolveData: unresolved path passes through unchanged (fail-safe)', () => {
  const data = { S: {}, catalog: {}, rc: null };
  assert.equal(resolveData('@S.missing.path', data), '@S.missing.path');
  assert.equal(resolveData('@rc.offerings', data), '@rc.offerings');
});

test('resolveData: non-@ strings untouched', () => {
  const data = { S: { x: 1 }, catalog: {}, rc: null };
  assert.equal(resolveData('plain text', data), 'plain text');
  assert.equal(resolveData('$accent', data), '$accent');
});

test('resolveData: non-string values untouched', () => {
  const data = { S: {}, catalog: {}, rc: null };
  assert.equal(resolveData(42, data), 42);
  assert.equal(resolveData(true, data), true);
  assert.equal(resolveData(null, data), null);
  assert.equal(resolveData(undefined, data), undefined);
});

test('resolveData: deep-walks nested objects and arrays', () => {
  const data = { S: { guitar: 'Strat', amp: 'JCM800' }, catalog: {}, rc: null };
  const node = {
    type: 'card',
    children: [
      { type: 'text', text: '@S.guitar' },
      { type: 'row', children: [{ type: 'text', text: '@S.amp' }, { type: 'text', text: 'static' }] },
    ],
  };
  const out = resolveData(node, data);
  assert.equal(out.children[0].text, 'Strat');
  assert.equal(out.children[1].children[0].text, 'JCM800');
  assert.equal(out.children[1].children[1].text, 'static');
});

test('resolveData: null/undefined data handled safely without throwing', () => {
  assert.doesNotThrow(() => resolveData('@S.guitar', null));
  assert.doesNotThrow(() => resolveData('@S.guitar', undefined));
  assert.equal(resolveData('@S.guitar', null), '@S.guitar');
  assert.equal(resolveData({ a: '@catalog.X' }, undefined).a, '@catalog.X');
});
