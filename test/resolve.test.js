import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokens } from '../src/resolve.js';
const th = { accent: '#FF5A1F', bg: '#0A0A0C' };
test('string token', () => assert.equal(resolveTokens('$accent', th), '#FF5A1F'));
test('deep object+array', () => assert.deepEqual(
  resolveTokens({ style: { color: '$accent' }, items: [{ c: '$bg' }] }, th),
  { style: { color: '#FF5A1F' } , items: [{ c: '#0A0A0C' }] }));
test('unknown token untouched', () => assert.equal(resolveTokens('$nope', th), '$nope'));
test('non-token string untouched', () => assert.equal(resolveTokens('hello', th), 'hello'));
