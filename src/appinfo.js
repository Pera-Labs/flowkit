// Pure assembly of the built-in `@app.*` metadata data source (v0.4.0).
// `sources` = best-effort readings from optional native modules (expo-application,
// expo-constants, expo-updates, __DEV__ — read by FlowKitProvider via dynamic
// require, never here). `overrides` = the host's `appInfo` prop, which always
// wins over an auto-detected source. Any field neither source nor override
// supplies resolves to `null` — this function never throws.

const FIELDS = ['version', 'buildNumber', 'isDev', 'updateId', 'channel', 'runtimeVersion', 'configRevision'];

export function assembleAppInfo(sources, overrides) {
  const s = sources || {};
  const o = overrides || {};
  const out = {};
  for (const f of FIELDS) {
    const ov = o[f];
    if (ov !== undefined) out[f] = ov;
    else if (s[f] !== undefined && s[f] !== null) out[f] = s[f];
    else out[f] = null;
  }

  // isReview: env-style flag from sources/overrides, OR overrides.reviewVersion
  // matching the resolved version (ToneAdapt's IS_REVIEW + IS_REVIEW_VERSION merged).
  let isReview = o.isReview !== undefined ? !!o.isReview : (s.isReview !== undefined ? !!s.isReview : false);
  if (!isReview && o.reviewVersion !== undefined && o.reviewVersion !== null && out.version !== null && o.reviewVersion === out.version) {
    isReview = true;
  }
  out.isReview = isReview;
  out.isDev = out.isDev === null ? false : !!out.isDev;
  return out;
}

// versionLt(a, b) -> true iff semver-ish `a` < `b`, comparing numeric dot
// segments left to right (missing trailing segments treated as 0). Any
// missing/non-string/unparseable input fails open to `false` (don't gate) —
// a min-app-version check would rather let an app through than block it on
// a malformed config value.
export function versionLt(a, b) {
  try {
    if (typeof a !== 'string' || typeof b !== 'string' || !a.trim() || !b.trim()) return false;
    const pa = a.trim().split('.');
    const pb = b.trim().split('.');
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = Number.parseInt(pa[i], 10);
      const nb = Number.parseInt(pb[i], 10);
      const va = Number.isFinite(na) ? na : 0;
      const vb = Number.isFinite(nb) ? nb : 0;
      if (va < vb) return true;
      if (va > vb) return false;
    }
    return false;
  } catch {
    return false;
  }
}
