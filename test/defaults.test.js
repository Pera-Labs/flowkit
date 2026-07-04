import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, DEFAULT_SCREENS } from '../src/defaults.js';
import { sanitizeConfig } from '../src/configChain.js';
import { computeEntry } from '../src/sequencer.js';
test('default config valid + entry çalışır', () => {
  const c = DEFAULT_CONFIG('x');
  assert.ok(sanitizeConfig(c));
  const e = computeEntry({ config: c, state: { completed: {} }, registryKeys: [], hasTemplate: (id) => !!DEFAULT_SCREENS[id] });
  assert.equal(e.flowId, 'onboarding'); assert.equal(e.screenId, 'ob-welcome');
});
test('default şablonlar 4 ekran', () => assert.deepEqual(Object.keys(DEFAULT_SCREENS).sort(), ['ob-start', 'ob-value', 'ob-welcome', 'pw-main']));
