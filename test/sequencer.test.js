import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleScreens, computeEntry, advance, gotoScreen } from '../src/sequencer.js';

const cfg = (over = {}) => ({
  schemaVersion: 1, appId: 'a', revision: 1,
  flows: {
    onboarding: { enabled: true, screens: ['s1', 's2', 'g1'], endAction: 'flow.goto:paywall' },
    paywall: { enabled: true, screens: ['pw'], trigger: 'post-onboarding' },
    main: { enabled: true, type: 'app', screens: [] },
    ...over.flows,
  },
  screens: {
    s1: { kind: 'sdui', template: { type: 'stack' } },
    s2: { kind: 'sdui', template: { type: 'stack' } },
    g1: { kind: 'native', ref: 'gear' },
    pw: { kind: 'sdui', template: { type: 'stack' } },
    ...over.screens,
  },
});
const OPTS = { registryKeys: ['gear'], hasTemplate: () => true };

test('visible: hidden düşer', () => {
  const c = cfg({ screens: { s2: { kind: 'sdui', hidden: true, template: { type: 'stack' } } } });
  assert.deepEqual(visibleScreens(c, 'onboarding', OPTS.registryKeys, OPTS.hasTemplate), ['s1', 'g1']);
});
test('visible: registry-siz native düşer', () => {
  assert.deepEqual(visibleScreens(cfg(), 'onboarding', [], OPTS.hasTemplate), ['s1', 's2']);
});
test('entry: fresh -> onboarding ilk ekran', () => {
  assert.deepEqual(computeEntry({ config: cfg(), state: { completed: {} }, ...OPTS }), { flowId: 'onboarding', screenId: 's1', index: 0 });
});
test('entry: onboarding disabled -> main (post-onboarding paywall pop etmez)', () => {
  const c = cfg({ flows: { onboarding: { enabled: false, screens: ['s1'], endAction: 'flow.goto:paywall' } } });
  assert.deepEqual(computeEntry({ config: c, state: { completed: {} }, ...OPTS }), { flowId: 'main' });
});
test('entry: completed -> main', () => {
  assert.deepEqual(computeEntry({ config: cfg(), state: { completed: { onboarding: true } }, ...OPTS }), { flowId: 'main' });
});
test('entry: cold-start paywall her açılışta', () => {
  const c = cfg({ flows: { paywall: { enabled: true, screens: ['pw'], trigger: 'cold-start' } } });
  assert.deepEqual(computeEntry({ config: c, state: { completed: { onboarding: true } }, ...OPTS }), { flowId: 'paywall', screenId: 'pw', index: 0 });
});
test('advance: flow.next ekran ilerletir', () => {
  const r = advance({ config: cfg(), state: { completed: {} }, at: { flowId: 'onboarding', index: 0 }, action: 'flow.next', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'onboarding', screenId: 's2', index: 1 });
  assert.equal(r.stateChanges, null);
});
test('advance: son ekranda next -> endAction (paywall) + completed', () => {
  const r = advance({ config: cfg(), state: { completed: {} }, at: { flowId: 'onboarding', index: 2 }, action: 'flow.next', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'paywall', screenId: 'pw', index: 0 });
  assert.deepEqual(r.stateChanges, { completed: { onboarding: true } });
});
test('advance: flow.skip -> complete + endAction', () => {
  const r = advance({ config: cfg(), state: { completed: {} }, at: { flowId: 'onboarding', index: 0 }, action: 'flow.skip', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'paywall', screenId: 'pw', index: 0 });
  assert.deepEqual(r.stateChanges, { completed: { onboarding: true } });
});
test('advance: flow.back steps to previous screen', () => {
  const r = advance({ config: cfg(), state: { completed: {} }, at: { flowId: 'onboarding', index: 1 }, action: 'flow.back', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'onboarding', screenId: 's1', index: 0 });
  assert.equal(r.stateChanges, null);
});
test('advance: flow.back at first screen -> main (never negative index)', () => {
  const r = advance({ config: cfg(), state: { completed: {} }, at: { flowId: 'onboarding', index: 0 }, action: 'flow.back', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'main' });
});
test('advance: paywall bitince main', () => {
  const r = advance({ config: cfg(), state: { completed: { onboarding: true } }, at: { flowId: 'paywall', index: 0 }, action: 'flow.next', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'main' });
});
test('advance: goto disabled flow -> main (asla crash yok)', () => {
  const c = cfg({ flows: { paywall: { enabled: false, screens: ['pw'], trigger: 'post-onboarding' } } });
  const r = advance({ config: c, state: { completed: {} }, at: { flowId: 'onboarding', index: 2 }, action: 'flow.next', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'main' });
});
test('advance: boş flow (tüm ekranlar gizli) -> endAction', () => {
  const c = cfg({ screens: { s1: { kind: 'sdui', hidden: true }, s2: { kind: 'sdui', hidden: true }, g1: { kind: 'native', hidden: true, ref: 'gear' } } });
  assert.deepEqual(computeEntry({ config: c, state: { completed: {} }, ...OPTS }), { flowId: 'paywall', screenId: 'pw', index: 0 });
});
test('visible: empty screens map + bundled defaults still render', () => {
  const c = cfg(); c.screens = {};
  assert.deepEqual(visibleScreens(c, 'onboarding', [], (id) => ['s1','s2'].includes(id)), ['s1', 's2']);
});
test('entry: server seed shape (screens {}) with defaults -> onboarding first screen', () => {
  const c = cfg(); c.screens = {};
  assert.deepEqual(computeEntry({ config: c, state: { completed: {} }, registryKeys: [], hasTemplate: (id) => ['s1','s2','pw'].includes(id) }), { flowId: 'onboarding', screenId: 's1', index: 0 });
});

// v0.6.0 — nav.goto:<screenId>
test('gotoScreen: screen in a non-current flow resolves {flowId, screenId, index}', () => {
  assert.deepEqual(gotoScreen(cfg(), 'pw', OPTS.registryKeys, OPTS.hasTemplate), { flowId: 'paywall', screenId: 'pw', index: 0 });
});
test('gotoScreen: second screen of a flow resolves with its visible index', () => {
  assert.deepEqual(gotoScreen(cfg(), 's2', OPTS.registryKeys, OPTS.hasTemplate), { flowId: 'onboarding', screenId: 's2', index: 1 });
});
test('gotoScreen: screen in main flow resolves against main', () => {
  const c = cfg({ flows: { main: { enabled: true, type: 'app', screens: ['home', 'settings'] } }, screens: { home: { kind: 'sdui', template: { type: 'stack' } }, settings: { kind: 'sdui', template: { type: 'stack' } } } });
  assert.deepEqual(gotoScreen(c, 'settings', OPTS.registryKeys, OPTS.hasTemplate), { flowId: 'main', screenId: 'settings', index: 1 });
});
test('gotoScreen: unknown screenId -> null', () => {
  assert.equal(gotoScreen(cfg(), 'nope', OPTS.registryKeys, OPTS.hasTemplate), null);
});
test('gotoScreen: hidden screen still resolves (explicit jump overrides visibility filter)', () => {
  const c = cfg({ screens: { s2: { kind: 'sdui', hidden: true, template: { type: 'stack' } } } });
  // s2 is hidden -> vis is ['s1','g1']. gotoScreen renders s2 but returns an
  // index RELATIVE TO vis (0, i.e. sitting "before" g1) so a following flow.next
  // lands on g1 (the next visible screen) — NOT the raw flow.screens index (1),
  // which would overshoot vis.length in advance() and prematurely followEnd.
  assert.deepEqual(gotoScreen(c, 's2', OPTS.registryKeys, OPTS.hasTemplate), { flowId: 'onboarding', screenId: 's2', index: 0 });
});
test('gotoScreen→flow.next: from a hidden screen advances to the next VISIBLE screen (not followEnd)', () => {
  const c = cfg({ screens: { s2: { kind: 'sdui', hidden: true, template: { type: 'stack' } } } });
  const at = gotoScreen(c, 's2', OPTS.registryKeys, OPTS.hasTemplate); // { onboarding, s2, index:0 }
  const r = advance({ config: c, state: { completed: {} }, at, action: 'flow.next', ...OPTS });
  assert.deepEqual(r.next, { flowId: 'onboarding', screenId: 'g1', index: 1 }); // g1, not a premature flow-end
});
test('gotoScreen: hidden screen that is LAST -> flow.next triggers followEnd', () => {
  const c = cfg({ flows: { onboarding: { enabled: true, screens: ['s1', 's2'], endAction: 'flow.goto:paywall' } }, screens: { s2: { kind: 'sdui', hidden: true, template: { type: 'stack' } } } });
  const at = gotoScreen(c, 's2', OPTS.registryKeys, OPTS.hasTemplate); // s2 hidden+last -> index vis.length-1 = 0
  assert.deepEqual(at, { flowId: 'onboarding', screenId: 's2', index: 0 });
  const r = advance({ config: c, state: { completed: {} }, at, action: 'flow.next', ...OPTS });
  assert.equal(r.next.flowId, 'paywall'); // no visible screen after -> followEnd -> paywall
});
test('gotoScreen: native screen whose ref is missing from the registry -> null', () => {
  assert.equal(gotoScreen(cfg(), 'g1', [], OPTS.hasTemplate), null);
});
test('gotoScreen: sdui screen with no explicit template and no bundled default -> null', () => {
  const c = cfg({ flows: { main: { enabled: true, type: 'app', screens: ['orphan'] } } });
  assert.equal(gotoScreen(c, 'orphan', OPTS.registryKeys, () => false), null);
});

// initialScreen (v0.6.7, FlowKitProvider boot) — the composition is
// `entry = computeEntry(...); if (initialScreen) { const forced =
// gotoScreen(...); if (forced) entry = forced; }`. These tests exercise
// that exact composition against sequencer's pure functions (FlowKitProvider
// itself isn't node:test-able — needs a React/RN runtime, see its header
// comment) so the deep-link-bypasses-onboarding contract stays covered.
function resolveEntry(config, state, initialScreen, opts = OPTS) {
  let entry = computeEntry({ config, state, ...opts });
  if (initialScreen) {
    const forced = gotoScreen(config, initialScreen, opts.registryKeys, opts.hasTemplate);
    if (forced) entry = forced;
  }
  return entry;
}
test('initialScreen: fresh state (onboarding not completed) still resolves straight to the target screen', () => {
  const c = cfg({ flows: { main: { enabled: true, type: 'app', screens: ['home'] } }, screens: { home: { kind: 'sdui', template: { type: 'stack' } } } });
  assert.deepEqual(resolveEntry(c, { completed: {} }, 'home'), { flowId: 'main', screenId: 'home', index: 0 });
});
test('initialScreen: bypasses onboarding-gate for a screen defined inside another flow', () => {
  assert.deepEqual(resolveEntry(cfg(), { completed: {} }, 'pw'), { flowId: 'paywall', screenId: 'pw', index: 0 });
});
test('initialScreen: unresolved id (typo/unregistered) falls back to computeEntry, never a dead screen', () => {
  assert.deepEqual(resolveEntry(cfg(), { completed: {} }, 'nope'), { flowId: 'onboarding', screenId: 's1', index: 0 });
});
test('initialScreen: absent -> behaves exactly like plain computeEntry', () => {
  assert.deepEqual(resolveEntry(cfg(), { completed: { onboarding: true } }, undefined), { flowId: 'main' });
});
