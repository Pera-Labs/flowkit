import { visibleScreens } from './sequencer.js';

// Pure render-decision helper: given the current entry (flowId+screenId),
// decide how to render it. Never throws — unknown/missing screens resolve
// to 'skip' so the caller can fail-safe (e.g. advance to the next visible
// screen, or fall back to children).
export function screenRender(config, entry, registryKeys, hasTemplate) {
  const screenId = entry && entry.screenId;
  if (!screenId) return { mode: 'skip', screenId: null };
  const def = (config && config.screens && config.screens[screenId]) || null;
  const reg = new Set(registryKeys || []);
  const bundled = !!(hasTemplate && hasTemplate(screenId));

  if (def && def.kind === 'native') {
    if (reg.has(def.ref)) return { mode: 'native', screenId, ref: def.ref };
    return { mode: 'skip', screenId };
  }
  if (def && def.kind === 'sdui') {
    if (def.template || bundled) return { mode: 'sdui', screenId, template: def.template || null };
    return { mode: 'skip', screenId };
  }
  // No explicit def: fall back to a bundled sdui template if one exists.
  if (!def && bundled) return { mode: 'sdui', screenId, template: null };
  return { mode: 'skip', screenId };
}

// Ordered list of visible tab-shell screen ids for the `main` flow. Returns
// [] when `main` isn't a tabs flow (type !== 'tabs') or has no visible screens.
export function tabScreens(config, registryKeys, hasTemplate) {
  const main = config && config.flows && config.flows.main;
  if (!main || main.type !== 'tabs') return [];
  return visibleScreens(config, 'main', registryKeys, hasTemplate);
}
