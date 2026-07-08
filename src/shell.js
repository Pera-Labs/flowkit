import { visibleScreens } from './sequencer.js';

// Pure helper: resolve which template a screen def should actually render.
// Screens may carry a `variants` array (Studio v2 A/B authoring) plus an
// `activeVariant` id pointing at the live one. When present and the id
// resolves, that variant's template wins; otherwise (no variants array, no
// activeVariant, or an activeVariant that doesn't match any variant id) we
// fall back to the screen's own `template` — byte-for-byte the old behavior.
export function effectiveTemplate(screen) {
  if (!screen) return undefined;
  if (Array.isArray(screen.variants) && screen.activeVariant) {
    const v = screen.variants.find((v) => v && v.id === screen.activeVariant);
    if (v && v.template) return v.template;
  }
  return screen.template;
}

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
    const tpl = effectiveTemplate(def);
    if (tpl || bundled) return { mode: 'sdui', screenId, template: tpl || null };
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

// v0.6.8 — given a resolved nav entry (boot entry after initialScreen override,
// or a live nav.goto target) and the current tab id list, decide which tab
// should become active. Returns null when the entry doesn't target a specific
// `main`-flow tab (e.g. mid-onboarding, or a bare `{flowId:'main'}` with no
// screenId from computeEntry) — the caller should leave the active tab alone
// (or fall back to the first tab) in that case. Pure/unit-testable: the actual
// tab-selection bug (deep-linking to a tab never selected it) lived in
// FlowKitProvider not calling anything like this at all.
export function entryTabId(entry, tabIds) {
  if (!entry || entry.flowId !== 'main' || !entry.screenId) return null;
  return (tabIds || []).includes(entry.screenId) ? entry.screenId : null;
}
