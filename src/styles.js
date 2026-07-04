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
  // v0.2.0 tier-2 (static/tap-only approximations — see MASTER-SPEC section 2)
  'starRating', 'coverArt', 'priceOptionList', 'freqChart', 'knobGauge',
  // v0.3.0
  'signalChain',
]);

export function isKnownType(t) { return KNOWN_TYPES.has(t); }

// --- v0.3.0 pure layout helpers (dependency-free, unit-testable) ---

// freqChartBars({ values|bars, a, b, height }) -> normalized bar heights for
// single- or dual-series freqChart. `a`/`b` win over `values`/`bars` when
// present — dual series is the diff.json "theirs vs yours" comparison.
// Both series share one max so bars are comparable on the same scale.
export function freqChartBars({ values, bars, a, b, height = 80 } = {}) {
  const av = Array.isArray(a) ? a : Array.isArray(values) ? values : Array.isArray(bars) ? bars : [];
  const bv = Array.isArray(b) ? b : null;
  const nums = (arr) => arr.map((v) => Math.max(0, Number(v) || 0));
  const aNums = nums(av);
  const bNums = bv ? nums(bv) : [];
  const max = Math.max(1, ...aNums, ...bNums);
  const toHeights = (arr) => arr.map((v) => Math.max(2, (v / max) * height));
  return { aHeights: toHeights(aNums), bHeights: bv ? toHeights(bNums) : null, dual: !!bv, max };
}

// signalChainItems(nodes, connector) -> [{ node, connectorAfter }], connector
// omitted after the last node. Pure so layout/connector logic is testable
// without mounting components.js.
export function signalChainItems(nodes, connector = '→') {
  const arr = Array.isArray(nodes) ? nodes : [];
  return arr.map((n, i) => ({ node: n, connectorAfter: i < arr.length - 1 ? connector : null }));
}

// buttonDims(variant) -> style overrides layered on top of the default pill.
// Unknown/omitted variant -> null (caller keeps existing pill sizing).
export const BUTTON_VARIANTS = new Set(['pill', 'circle', 'compact']);
export function buttonDims(variant) {
  if (variant === 'circle') return { minHeight: 44, width: 44, borderRadius: 22, paddingHorizontal: 0 };
  if (variant === 'compact') return { minHeight: 36, borderRadius: 12, paddingHorizontal: 14 };
  return null;
}
