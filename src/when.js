// Minimal, safe `when` conditional evaluator for SDUI node visibility.
// NO eval()/new Function() — a tiny hand-rolled parser for the handful of
// forms actually used by ToneAdapt templates: bare truthy binding, negation,
// and === / !== literal comparison. Fail-open: any unknown/unparseable form
// or error resolves to `true` (show the node rather than hide it).

import { getPath } from './bind.js';

// `when` bindings are conventionally shorthand flags living on app state:
// `@isPro` means `@S.isPro`, `@flay.enabled` means `@S.flay.enabled`.
// Bindings explicitly prefixed with S./catalog./rc. still address that source.
function resolveBinding(atPath, data) {
  const body = atPath.slice(1); // drop leading @
  const dot = body.indexOf('.');
  const prefix = dot === -1 ? body : body.slice(0, dot);
  const rest = dot === -1 ? '' : body.slice(dot + 1);
  const d = data || {};
  if (prefix === 'S') return rest === '' ? d.S : getPath(d.S, rest);
  if (prefix === 'catalog') return rest === '' ? d.catalog : getPath(d.catalog, rest);
  if (prefix === 'rc') return rest === '' ? d.rc : getPath(d.rc, rest);
  return getPath(d.S, body); // unprefixed shorthand -> flag lives on state
}

const EXPR_RE = /^(!)?(@[\w.]+)(?:\s*(===|!==)\s*(.+))?$/;

const FAIL_OPEN = Symbol('when-literal-fail-open');

function parseLiteral(raw) {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (s === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const startsQuoted = s.startsWith("'") || s.startsWith('"');
  if (startsQuoted || s.endsWith("'") || s.endsWith('"')) {
    // Only a cleanly matched pair of quotes is a valid string literal.
    // A mismatched/unterminated quote (e.g. "it's") is unparseable —
    // fail open rather than comparing the raw quoted token.
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      return s.slice(1, -1);
    }
    return FAIL_OPEN;
  }
  return s; // bare word — treat as literal string
}

export function evalWhen(expr, data) {
  try {
    if (typeof expr !== 'string' || expr.trim() === '') return true;
    const m = EXPR_RE.exec(expr.trim());
    if (!m) return true; // unknown form — fail open
    const [, bang, binding, op, litRaw] = m;
    const resolved = resolveBinding(binding, data);
    if (op) {
      const lit = parseLiteral(litRaw);
      if (lit === FAIL_OPEN) return true;
      const eq = resolved === lit;
      return op === '===' ? eq : !eq;
    }
    const truthy = !!resolved;
    return bang ? !truthy : truthy;
  } catch {
    return true; // never throw — fail open
  }
}
