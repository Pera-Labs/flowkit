import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenBackground } from '../src/resolve.js';

const th = { bg: '#0A0A0C', bgDark: '#000000' };

test('template root $bgDark wins over theme.bg', () => {
  const template = { type: 'stack', style: { backgroundColor: '$bgDark' } };
  assert.equal(screenBackground(template, th), '#000000');
});

test('template with no root bg falls back to theme.bg', () => {
  const template = { type: 'stack' };
  assert.equal(screenBackground(template, th), '#0A0A0C');
});

test('unknown token passes through unresolved (matches resolveTokens contract)', () => {
  const template = { type: 'stack', style: { backgroundColor: '$nope' } };
  assert.equal(screenBackground(template, th), '$nope');
});

test('non-string resolved value falls back to theme.bg', () => {
  const template = { type: 'stack', style: { backgroundColor: 42 } };
  assert.equal(screenBackground(template, th), '#0A0A0C');
});
