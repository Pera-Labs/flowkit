import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenRender, tabScreens } from '../src/shell.js';

function cfg(overrides) {
  return {
    schemaVersion: 1, appId: 'x', revision: 0,
    flows: { main: { enabled: true, type: 'tabs', screens: ['t-home', 't-native', 't-hidden'] } },
    screens: {
      't-home': { kind: 'sdui', template: { type: 'text', text: 'home' } },
      't-native': { kind: 'native', ref: 'HomeScreen' },
      't-hidden': { kind: 'sdui', template: { type: 'text', text: 'x' }, hidden: true },
    },
    ...overrides,
  };
}

test('screenRender: sdui with explicit template', () => {
  const config = cfg();
  const r = screenRender(config, { flowId: 'main', screenId: 't-home' }, [], () => false);
  assert.equal(r.mode, 'sdui');
  assert.equal(r.screenId, 't-home');
  assert.ok(r.template);
});

test('screenRender: sdui with bundled default template (no explicit template)', () => {
  const config = cfg({ screens: { 'ob-welcome': { kind: 'sdui' } } });
  const r = screenRender(config, { flowId: 'onboarding', screenId: 'ob-welcome' }, [], (id) => id === 'ob-welcome');
  assert.equal(r.mode, 'sdui');
  assert.equal(r.template, null); // caller falls back to DEFAULT_SCREENS[screenId]
});

test('screenRender: sdui kind but no template and no bundled default -> skip', () => {
  const config = cfg({ screens: { 'weird': { kind: 'sdui' } } });
  const r = screenRender(config, { flowId: 'main', screenId: 'weird' }, [], () => false);
  assert.equal(r.mode, 'skip');
});

test('screenRender: native with ref present in registry', () => {
  const config = cfg();
  const r = screenRender(config, { flowId: 'main', screenId: 't-native' }, ['HomeScreen'], () => false);
  assert.equal(r.mode, 'native');
  assert.equal(r.ref, 'HomeScreen');
});

test('screenRender: native with ref missing from registry -> skip', () => {
  const config = cfg();
  const r = screenRender(config, { flowId: 'main', screenId: 't-native' }, [], () => false);
  assert.equal(r.mode, 'skip');
});

test('screenRender: no entry screenId -> skip', () => {
  const config = cfg();
  const r = screenRender(config, { flowId: 'main' }, [], () => false);
  assert.equal(r.mode, 'skip');
  assert.equal(r.screenId, null);
});

test('screenRender: screen id not present in config.screens at all, no bundled default -> skip', () => {
  const config = cfg();
  const r = screenRender(config, { flowId: 'main', screenId: 'ghost' }, [], () => false);
  assert.equal(r.mode, 'skip');
});

test('screenRender: never throws on malformed config', () => {
  assert.doesNotThrow(() => screenRender(null, { flowId: 'main', screenId: 'x' }, null, null));
  assert.doesNotThrow(() => screenRender({}, {}, undefined, undefined));
});

test('tabScreens: orders visible tab-flow screens, dropping hidden/unregistered', () => {
  const config = cfg();
  const ids = tabScreens(config, ['HomeScreen'], () => false);
  assert.deepEqual(ids, ['t-home', 't-native']);
});

test('tabScreens: drops native tab when ref not in registry', () => {
  const config = cfg();
  const ids = tabScreens(config, [], () => false);
  assert.deepEqual(ids, ['t-home']);
});

test('tabScreens: main flow type !== "tabs" -> not a tab shell, returns []', () => {
  const config = cfg({ flows: { main: { enabled: true, type: 'app', screens: ['t-home'] } } });
  const ids = tabScreens(config, [], () => false);
  assert.deepEqual(ids, []);
});

test('tabScreens: missing main flow -> []', () => {
  const ids = tabScreens({ flows: {} }, [], () => false);
  assert.deepEqual(ids, []);
});
