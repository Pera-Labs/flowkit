export function resolveTokens(v, theme) {
  if (typeof v === 'string') {
    if (v.startsWith('$')) { const k = v.slice(1); return k in theme ? theme[k] : v; }
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => resolveTokens(x, theme));
  if (v && typeof v === 'object') {
    const o = {}; for (const k of Object.keys(v)) o[k] = resolveTokens(v[k], theme); return o;
  }
  return v;
}

// Resolves the background an SDUI screen wrapper should paint. If the
// template's root node declares its own `style.backgroundColor` (e.g.
// "$bgDark"), that wins — the template is opting into a non-default
// background and the outer screen wrapper must not paint over it with
// theme.bg. Falls back to theme.bg when the template has no root bg, or
// when resolution produces anything but a non-empty string (malformed
// token, missing theme entry, etc).
export function screenBackground(template, theme) {
  const raw = template && template.style && template.style.backgroundColor;
  if (raw == null) return theme.bg;
  const resolved = resolveTokens(raw, theme);
  return typeof resolved === 'string' && resolved ? resolved : theme.bg;
}
