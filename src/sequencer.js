import { parseAction } from './parseAction.js';

export function visibleScreens(config, flowId, registryKeys, hasTemplate) {
  const flow = config.flows[flowId];
  if (!flow || !Array.isArray(flow.screens)) return [];
  const reg = new Set(registryKeys || []);
  return flow.screens.filter((id) => {
    const def = config.screens[id];
    if (!def || def.hidden) return false;
    if (def.kind === 'native') return reg.has(def.ref);
    if (def.kind === 'sdui') return !!def.template || (hasTemplate && hasTemplate(id));
    return false;
  });
}

function enterFlow(config, flowId, state, registryKeys, hasTemplate, hops = 0) {
  // hops: flow.goto zincir döngüsü guard'ı — 5'ten derinde main'e düş.
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

export function advance({ config, state, at, action, registryKeys, hasTemplate }) {
  const a = parseAction(action) || { type: 'flow.next', arg: null };
  const flowId = at.flowId;
  const vis = visibleScreens(config, flowId, registryKeys, hasTemplate);
  const mark = (completes) => (completes && !((state.completed || {})[completes]) ? { completed: { ...(state.completed || {}), [completes]: true } } : null);

  if (a.type === 'flow.goto') {
    const r = enterFlow(config, a.arg, state, registryKeys, hasTemplate);
    return { next: r.next, stateChanges: mark(flowId) };
  }
  if (a.type === 'flow.skip') {
    const r = followEnd(config, flowId, state, registryKeys, hasTemplate);
    return { next: r.next, stateChanges: mark(flowId) };
  }
  // flow.next (ve bilinmeyen action'lar next gibi davranır — asla kilitlenme)
  const ni = at.index + 1;
  if (ni < vis.length) return { next: { flowId, screenId: vis[ni], index: ni }, stateChanges: null };
  const r = followEnd(config, flowId, state, registryKeys, hasTemplate);
  return { next: r.next, stateChanges: mark(flowId) };
}
