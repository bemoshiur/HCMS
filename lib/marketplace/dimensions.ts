/**
 * Contract dimensions offered on the HCMS AWS Marketplace listing, lowest first.
 * The listing's offer must use exactly these API names. A buyer holding more than one
 * live dimension (an upgrade mid-term) is treated as the highest of them.
 */
export const DIMENSION_ORDER = ['standard', 'professional', 'enterprise'] as const;
export type Dimension = (typeof DIMENSION_ORDER)[number];

export interface EntitlementLike {
  readonly dimension?: string | undefined;
  readonly expirationDate?: Date | undefined;
}

export function isDimension(v: string): v is Dimension {
  return (DIMENSION_ORDER as readonly string[]).includes(v);
}

/** The highest known dimension that has not expired at `now`, or null. */
export function activeDimension(entitlements: readonly EntitlementLike[], now: Date): Dimension | null {
  let best = -1;
  for (const e of entitlements) {
    if (!e.dimension || !isDimension(e.dimension)) continue;
    if (e.expirationDate && e.expirationDate.getTime() <= now.getTime()) continue;
    best = Math.max(best, DIMENSION_ORDER.indexOf(e.dimension));
  }
  return best < 0 ? null : DIMENSION_ORDER[best]!;
}
