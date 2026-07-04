import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleScreens, computeEntry, advance } from '../src/sequencer.js';

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
