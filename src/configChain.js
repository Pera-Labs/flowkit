const cacheKey = (appId) => `fk.${appId}.config`;

export function sanitizeConfig(cfg) {
  if (!cfg || cfg.schemaVersion !== 1) return null;
  if (typeof cfg.flows !== 'object' || !cfg.flows) return null;
  if (typeof cfg.screens !== 'object' || !cfg.screens) return null;
  return cfg;
}

// Boot: cache -> bundled default. Asla throw etmez.
export async function loadInitialConfig({ appId, storage, defaultConfig }) {
  try {
    const raw = await storage.getItem(cacheKey(appId));
    if (raw) { const c = sanitizeConfig(JSON.parse(raw)); if (c) return c; }
  } catch {}
  return defaultConfig;
}

// Background fetch: 304 -> no-op, 404 -> register + re-GET, error -> no-op.
// On success writes to cache; NOT applied (picked up on next cold start).
export async function refreshConfig({ appId, endpoint, storage, currentRevision, fetchFn }) {
  const f = fetchFn || fetch;
  const url = `${endpoint}/app-config/${appId}`;
  try {
    let r = await f(url, { headers: { 'If-None-Match': `"${currentRevision}"` } });
    if (r.status === 304) return { updated: false, config: null };
    if (r.status === 404) {
      await f(`${url}/register`, { method: 'POST' });
      r = await f(url, {});
    }
    if (!r.ok) return { updated: false, config: null };
    const cfg = sanitizeConfig(await r.json());
    if (!cfg) return { updated: false, config: null };
    await storage.setItem(cacheKey(appId), JSON.stringify(cfg));
    return { updated: true, config: cfg };
  } catch { return { updated: false, config: null }; }
}
