// Data-binding layer for SDUI templates.
// Resolves @-prefixed string leaves against a runtime data object; never throws,
// unresolved bindings pass through unchanged (fail-safe rendering).

// getPath(obj, 'a.b.0.c') -> deep get, numeric segments index arrays. undefined on miss.
export function getPath(obj, path) {
  if (obj == null || typeof path !== 'string' || path === '') return undefined;
  const segs = path.split('.');
  let cur = obj;
  for (const seg of segs) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

// resolveData(node, data) -> deep-walked copy with @S/@catalog/@rc bindings resolved.
// data shape: { S, catalog, rc }. Any of them may be missing/null/undefined.
export function resolveData(v, data) {
  if (typeof v === 'string') {
    if (!v.startsWith('@')) return v;
    const body = v.slice(1); // e.g. "S.guitar", "catalog.GUITARS", "rc.offerings.0"
    const dot = body.indexOf('.');
    const prefix = dot === -1 ? body : body.slice(0, dot);
    const rest = dot === -1 ? '' : body.slice(dot + 1);
    const d = data || {};
    let root;
    if (prefix === 'S') root = d.S;
    else if (prefix === 'catalog') root = d.catalog;
    else if (prefix === 'rc') root = d.rc;
    else if (prefix === 'app') root = d.app; // v0.4.0 — built-in @app.* metadata
    else if (prefix === 'flag') root = d.flag; // v0.4.0 — config.flags
    else return v; // unknown prefix — leave as-is
    const resolved = rest === '' ? root : getPath(root, rest);
    return resolved === undefined ? v : resolved;
  }
  if (Array.isArray(v)) return v.map((x) => resolveData(x, data));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = resolveData(v[k], data);
    return o;
  }
  return v;
}
