import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeConfig, loadInitialConfig, refreshConfig } from '../src/configChain.js';

const memStorage = (init = {}) => { const m = { ...init }; return {
  getItem: async (k) => (k in m ? m[k] : null), setItem: async (k, v) => { m[k] = v; }, _m: m }; };
const CFG = { schemaVersion: 1, appId: 'a', revision: 3, flows: { main: { enabled: true, screens: [] } }, screens: {} };

test('sanitize rejects', () => { assert.equal(sanitizeConfig({}), null); assert.equal(sanitizeConfig({ schemaVersion: 2, flows: {}, screens: {} }), null); assert.ok(sanitizeConfig(CFG)); });
test('initial: cache wins', async () => {
  const st = memStorage({ 'fk.a.config': JSON.stringify(CFG) });
  assert.equal((await loadInitialConfig({ appId: 'a', storage: st, defaultConfig: { ...CFG, revision: 0 } })).revision, 3);
});
test('initial: corrupt cache -> default', async () => {
  const st = memStorage({ 'fk.a.config': '{bozuk' });
  assert.equal((await loadInitialConfig({ appId: 'a', storage: st, defaultConfig: { ...CFG, revision: 0 } })).revision, 0);
});
test('refresh 200 caches', async () => {
  const st = memStorage();
  const f = async () => ({ status: 200, ok: true, json: async () => ({ ...CFG, revision: 4 }) });
  const r = await refreshConfig({ appId: 'a', endpoint: 'https://x/api', storage: st, currentRevision: 3, fetchFn: f });
  assert.equal(r.updated, true); assert.equal(JSON.parse(st._m['fk.a.config']).revision, 4);
});
test('refresh 304 no-op', async () => {
  const r = await refreshConfig({ appId: 'a', endpoint: 'https://x/api', storage: memStorage(), currentRevision: 3, fetchFn: async () => ({ status: 304, ok: false }) });
  assert.equal(r.updated, false);
});
test('refresh 404 registers then gets', async () => {
  const calls = [];
  const f = async (url, opts = {}) => { calls.push((opts.method || 'GET') + ' ' + url);
    if (calls.length === 1) return { status: 404, ok: false };
    if (calls.length === 2) return { status: 201, ok: true, json: async () => ({ ok: true }) };
    return { status: 200, ok: true, json: async () => ({ ...CFG, revision: 1 }) }; };
  const r = await refreshConfig({ appId: 'a', endpoint: 'https://x/api', storage: memStorage(), currentRevision: 0, fetchFn: f });
  assert.equal(r.updated, true); assert.match(calls[1], /register/);
});
test('refresh network error safe', async () => {
  const r = await refreshConfig({ appId: 'a', endpoint: 'https://x/api', storage: memStorage(), currentRevision: 0, fetchFn: async () => { throw new Error('net'); } });
  assert.equal(r.updated, false);
});
