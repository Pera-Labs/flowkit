import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenRender, tabScreens, effectiveTemplate, entryTabId } from '../src/shell.js';

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

// ---- entryTabId (v0.6.8 — deep-link-to-tab fix) ----

test('entryTabId: entry targets a live main-flow tab -> that tab id', () => {
  assert.equal(entryTabId({ flowId: 'main', screenId: 't-native' }, ['t-home', 't-native']), 't-native');
});

test('entryTabId: entry screenId not among current tab ids -> null (e.g. hidden/unregistered)', () => {
  assert.equal(entryTabId({ flowId: 'main', screenId: 't-hidden' }, ['t-home', 't-native']), null);
});

test('entryTabId: entry flowId !== main (mid onboarding/paywall) -> null', () => {
  assert.equal(entryTabId({ flowId: 'onboarding', screenId: 't-home' }, ['t-home', 't-native']), null);
});

test('entryTabId: bare {flowId:"main"} with no screenId (normal cold boot via computeEntry) -> null', () => {
  assert.equal(entryTabId({ flowId: 'main' }, ['t-home', 't-native']), null);
});

test('entryTabId: null/undefined entry or tab list -> null, never throws', () => {
  assert.doesNotThrow(() => entryTabId(null, ['t-home']));
  assert.equal(entryTabId(null, ['t-home']), null);
  assert.equal(entryTabId({ flowId: 'main', screenId: 't-home' }, null), null);
  assert.equal(entryTabId(undefined, undefined), null);
});

// ---- effectiveTemplate (Studio v2 variants) ----

test('effectiveTemplate: no variants array -> falls back to screen.template unchanged', () => {
  const screen = { kind: 'sdui', template: { type: 'text', text: 'base' } };
  assert.deepEqual(effectiveTemplate(screen), { type: 'text', text: 'base' });
});

test('effectiveTemplate: variants present, activeVariant matches -> returns that variant template', () => {
  const screen = {
    kind: 'sdui', template: { type: 'text', text: 'base' },
    variants: [
      { id: 'a', name: 'A', template: { type: 'text', text: 'base' } },
      { id: 'b', name: 'B', template: { type: 'text', text: 'variant b' } },
    ],
    activeVariant: 'b',
  };
  assert.deepEqual(effectiveTemplate(screen), { type: 'text', text: 'variant b' });
});

test('effectiveTemplate: activeVariant set but does not match any variant id -> falls back to screen.template', () => {
  const screen = {
    kind: 'sdui', template: { type: 'text', text: 'base' },
    variants: [{ id: 'a', name: 'A', template: { type: 'text', text: 'a' } }],
    activeVariant: 'ghost',
  };
  assert.deepEqual(effectiveTemplate(screen), { type: 'text', text: 'base' });
});

test('effectiveTemplate: variants array present but no activeVariant -> falls back to screen.template', () => {
  const screen = {
    kind: 'sdui', template: { type: 'text', text: 'base' },
    variants: [{ id: 'a', name: 'A', template: { type: 'text', text: 'a' } }],
  };
  assert.deepEqual(effectiveTemplate(screen), { type: 'text', text: 'base' });
});

test('effectiveTemplate: matched variant has no template -> falls back to screen.template', () => {
  const screen = {
    kind: 'sdui', template: { type: 'text', text: 'base' },
    variants: [{ id: 'a', name: 'A' }],
    activeVariant: 'a',
  };
  assert.deepEqual(effectiveTemplate(screen), { type: 'text', text: 'base' });
});

test('effectiveTemplate: null/undefined screen -> undefined, never throws', () => {
  assert.doesNotThrow(() => effectiveTemplate(null));
  assert.equal(effectiveTemplate(null), undefined);
  assert.equal(effectiveTemplate(undefined), undefined);
});

test('screenRender: variants + activeVariant resolves to the live variant template', () => {
  const config = {
    schemaVersion: 1, appId: 'x', revision: 0,
    flows: { main: { enabled: true, screens: ['s1'] } },
    screens: {
      s1: {
        kind: 'sdui', template: { type: 'text', text: 'original' },
        variants: [
          { id: 'orig', name: 'Original', template: { type: 'text', text: 'original' } },
          { id: 'v2', name: 'Variant 2', template: { type: 'text', text: 'live' } },
        ],
        activeVariant: 'v2',
      },
    },
  };
  const r = screenRender(config, { flowId: 'main', screenId: 's1' }, [], () => false);
  assert.equal(r.mode, 'sdui');
  assert.deepEqual(r.template, { type: 'text', text: 'live' });
});
