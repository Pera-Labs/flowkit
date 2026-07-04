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
