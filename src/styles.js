// Pure layout helpers for SDUI container primitives (stack/row/card).
// Kept dependency-free so it is unit-testable without a React Native runtime;
// components.js consumes containerStyle() to build the actual View style.

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' };

// containerStyle({ row, props, style }) -> flattened RN style object.
// props: { gap, align, justify, pad, wrap }. Explicit `style` merges last (wins).
export function containerStyle({ row = false, props = {}, style = {} } = {}) {
  const p = props || {};
  const gapN = Number(p.gap);
  const out = {
    flexDirection: row ? 'row' : 'column',
    justifyContent: JUSTIFY[p.justify] || 'flex-start',
  };
  if (p.align != null) out.alignItems = ALIGN[p.align] || 'flex-start';
  if (Number.isFinite(gapN)) out.gap = Math.max(0, gapN);
  else if (p.gap != null) out.gap = 0; // non-numeric gap → 0, never NaN
  if (p.pad != null) { const pd = Number(p.pad); if (Number.isFinite(pd)) out.padding = pd; }
  if (p.wrap) out.flexWrap = 'wrap';
  return { ...out, ...(style || {}) };
}

export const KNOWN_TYPES = new Set([
  // v0.1.x
  'stack', 'text', 'image', 'spacer', 'badge', 'progressDots', 'button', 'choiceGrid',
  // v0.2.0 tier-1
  'row', 'card', 'divider', 'iconTile',
]);

export function isKnownType(t) { return KNOWN_TYPES.has(t); }
