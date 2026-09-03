let counter = 0;

/** Deterministic-enough DOM id generator for shared/ui form primitives (label/aria wiring). */
export function nextUniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
