import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleAppInfo, versionLt } from '../src/appinfo.js';

test('assembleAppInfo: merges sources with fallback to null', () => {
  const info = assembleAppInfo({ version: '1.2.3', buildNumber: '42' }, {});
  assert.equal(info.version, '1.2.3');
  assert.equal(info.buildNumber, '42');
  assert.equal(info.updateId, null);
  assert.equal(info.channel, null);
  assert.equal(info.runtimeVersion, null);
  assert.equal(info.configRevision, null);
  assert.equal(info.isReview, false);
  assert.equal(info.isDev, false);
});

test('assembleAppInfo: missing sources -> null, never throws', () => {
  const info = assembleAppInfo(undefined, undefined);
  assert.equal(info.version, null);
  assert.equal(info.buildNumber, null);
});

test('assembleAppInfo: overrides win over sources', () => {
  const info = assembleAppInfo({ version: '1.0.0' }, { version: '2.0.0' });
  assert.equal(info.version, '2.0.0');
});

test('assembleAppInfo: override can explicitly null out a field', () => {
  const info = assembleAppInfo({ version: '1.0.0' }, { version: null });
  assert.equal(info.version, null);
});

test('assembleAppInfo: isReview from env-style source flag', () => {
  const info = assembleAppInfo({ isReview: true }, {});
  assert.equal(info.isReview, true);
});

test('assembleAppInfo: isReview true when overrides.reviewVersion matches resolved version', () => {
  const info = assembleAppInfo({ version: '3.1.0' }, { reviewVersion: '3.1.0' });
  assert.equal(info.isReview, true);
});

test('assembleAppInfo: isReview false when reviewVersion does not match', () => {
  const info = assembleAppInfo({ version: '3.1.0' }, { reviewVersion: '3.0.0' });
  assert.equal(info.isReview, false);
});

test('assembleAppInfo: isDev true from source', () => {
  const info = assembleAppInfo({ isDev: true }, {});
  assert.equal(info.isDev, true);
});

test('assembleAppInfo: configRevision passthrough', () => {
  const info = assembleAppInfo({ configRevision: 7 }, {});
  assert.equal(info.configRevision, 7);
});

test('versionLt: basic numeric segment comparisons', () => {
  assert.equal(versionLt('1.0.9', '1.1.0'), true);
  assert.equal(versionLt('1.1.0', '1.0.9'), false);
  assert.equal(versionLt('1.0.0', '1.0.0'), false);
  assert.equal(versionLt('1.2', '1.2.1'), true);
  assert.equal(versionLt('2.0.0', '1.9.9'), false);
});

test('versionLt: missing/garbage input fails open to false', () => {
  assert.equal(versionLt(null, '1.0.0'), false);
  assert.equal(versionLt('1.0.0', null), false);
  assert.equal(versionLt(undefined, undefined), false);
  assert.equal(versionLt('', '1.0.0'), false);
});

test('versionLt: non-numeric segments treated as 0', () => {
  // 'abc' -> [0] vs '1.0.0' -> [1,0,0]: 0 < 1 -> true
  assert.equal(versionLt('abc', '1.0.0'), true);
});
