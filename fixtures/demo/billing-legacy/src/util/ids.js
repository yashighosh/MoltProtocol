/**
 * Build the next display id from a short prefix and the current time.
 */
export function nextId(prefix) {
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}`;
}
