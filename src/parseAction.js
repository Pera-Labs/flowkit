export function parseAction(str) {
  if (typeof str !== 'string' || !str) return null;
  const i = str.indexOf(':');
  return i === -1 ? { type: str, arg: null } : { type: str.slice(0, i), arg: str.slice(i + 1) };
}
