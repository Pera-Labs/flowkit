import { parseAction } from './parseAction.js';

export function visibleScreens(config, flowId, registryKeys, hasTemplate) {
  const flow = config.flows[flowId];
  if (!flow || !Array.isArray(flow.screens)) return [];
  const reg = new Set(registryKeys || []);
  return flow.screens.filter((id) => {
    // Sparse config: fall back to a bare sdui def when the id is missing but a bundled template exists.
    const def = config.screens[id] || ((hasTemplate && hasTemplate(id)) ? { kind: 'sdui' } : null);
    if (!def || def.hidden) return false;
    if (def.kind === 'native') return reg.has(def.ref);
    if (def.kind === 'sdui') return !!def.template || (hasTemplate && hasTemplate(id));
    return false;
  });
}

function enterFlow(config, flowId, state, registryKeys, hasTemplate, hops = 0) {
  // hops: flow.goto chain cycle guard — fall back to main past depth 5.
  if (!flowId || flowId === 'main' || hops > 5) return { next: { flowId: 'main' }, completes: null };
  const flow = config.flows[flowId];
  if (!flow || !flow.enabled) return { next: { flowId: 'main' }, completes: null };
  const vis = visibleScreens(config, flowId, registryKeys, hasTemplate);
  if (!vis.length) return followEnd(config, flowId, state, registryKeys, hasTemplate, hops);
  return { next: { flowId, screenId: vis[0], index: 0 }, completes: null };
}

function followEnd(config, flowId, state, registryKeys, hasTemplate, hops = 0) {
  const a = parseAction(config.flows[flowId] && config.flows[flowId].endAction);
  const target = a && a.type === 'flow.goto' ? a.arg : 'main';
  const r = enterFlow(config, target, state, registryKeys, hasTemplate, hops + 1);
  return { next: r.next, completes: flowId };
}

export function computeEntry({ config, state, registryKeys, hasTemplate }) {
  const done = (state && state.completed) || {};
  const ob = config.flows.onboarding;
  if (ob && ob.enabled && !done.onboarding) {
    const vis = visibleScreens(config, 'onboarding', registryKeys, hasTemplate);
    if (vis.length) return { flowId: 'onboarding', screenId: vis[0], index: 0 };
    return followEnd(config, 'onboarding', state, registryKeys, hasTemplate).next;
  }
  const pw = config.flows.paywall;
  if (pw && pw.enabled && pw.trigger === 'cold-start') {
    const vis = visibleScreens(config, 'paywall', registryKeys, hasTemplate);
    if (vis.length) return { flowId: 'paywall', screenId: vis[0], index: 0 };
  }
  return { flowId: 'main' };
}

// nav.goto:<screenId> — resolve a screen id to an entry {flowId, screenId, index},
// searching every flow's `screens` array (not just the current one). Unlike
// flow.next/flow.back (which only ever land on a *visible* screen),
// nav.goto is an explicit jump: a screen that's DEFINED in some flow resolves
// even if `hidden: true` (an explicit target overrides the visibility filter
// that only exists to skip screens during normal forward/back sequencing).
// Returns null when the id isn't defined in any flow, or is defined but
// unrenderable (native ref missing from the registry, sdui with no
// template/bundled default) — never throws, caller no-ops on null.
export function gotoScreen(config, screenId, registryKeys, hasTemplate) {
  if (!screenId || !config || !config.flows) return null;
  const reg = new Set(registryKeys || []);
  for (const flowId of Object.keys(config.flows)) {
    const flow = config.flows[flowId];
    if (!flow || !Array.isArray(flow.screens) || !flow.screens.includes(screenId)) continue;
    const vis = visibleScreens(config, flowId, registryKeys, hasTemplate);
    const visIndex = vis.indexOf(screenId);
    if (visIndex !== -1) return { flowId, screenId, index: visIndex };
    // Hidden (or otherwise filtered out of `vis`) — still resolve if renderable.
    const def = config.screens[screenId] || ((hasTemplate && hasTemplate(screenId)) ? { kind: 'sdui' } : null);
    if (!def) return null;
    if (def.kind === 'native' && !reg.has(def.ref)) return null;
    if (def.kind === 'sdui' && !(def.template || (hasTemplate && hasTemplate(screenId)))) return null;
    return { flowId, screenId, index: flow.screens.indexOf(screenId) };
  }
  return null;
}

export function advance({ config, state, at, action, registryKeys, hasTemplate }) {
  const a = parseAction(action) || { type: 'flow.next', arg: null };
  const flowId = at.flowId;
  const vis = visibleScreens(config, flowId, registryKeys, hasTemplate);
  const mark = (completes) => (completes && !((state.completed || {})[completes]) ? { completed: { ...(state.completed || {}), [completes]: true } } : null);

  if (a.type === 'flow.back') {
    const pi = at.index - 1;
    if (pi >= 0) return { next: { flowId, screenId: vis[pi], index: pi }, stateChanges: null };
    return { next: { flowId: 'main' }, stateChanges: null };
  }
  if (a.type === 'flow.goto') {
    const r = enterFlow(config, a.arg, state, registryKeys, hasTemplate);
    return { next: r.next, stateChanges: mark(flowId) };
  }
  if (a.type === 'flow.skip') {
    const r = followEnd(config, flowId, state, registryKeys, hasTemplate);
    return { next: r.next, stateChanges: mark(flowId) };
  }
  // flow.next (and unknown actions behave like next — never get stuck)
  const ni = at.index + 1;
  if (ni < vis.length) return { next: { flowId, screenId: vis[ni], index: ni }, stateChanges: null };
  const r = followEnd(config, flowId, state, registryKeys, hasTemplate);
  return { next: r.next, stateChanges: mark(flowId) };
}
