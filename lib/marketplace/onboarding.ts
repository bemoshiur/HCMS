import { z } from 'zod';
import { hashOnboardingToken } from './register';

/**
 * The buyer's contact details, captured once after purchase so TiCON can provision
 * their HCMS environment. The onboarding token is single use: the row's hash
 * is cleared in the same UPDATE that stores the details.
 */
export const onboardingSchema = z.object({
  token: z.string().min(20).max(200),
  organisationName: z.string().trim().min(2).max(255),
  contactName: z.string().trim().min(2).max(255),
  contactEmail: z.string().trim().toLowerCase().email().max(320),
  contactPhone: z
    .string()
    .trim()
    .max(32)
    .regex(/^\+?[0-9 ()-]{6,32}$/, 'phone')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  country: z.string().trim().min(2).max(64),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export interface OnboardingRecord {
  readonly id: string;
  readonly customerAwsAccountId: string;
  readonly entitlementDimension: string | null;
}

export interface OnboardingDeps {
  readonly now: () => Date;
  /** Atomically store the details where the token hash matches, is unexpired and unused. */
  claimOnboarding(tokenHash: string, now: Date, input: Omit<OnboardingInput, 'token'>): Promise<OnboardingRecord | null>;
  notifyTicon(record: OnboardingRecord, input: Omit<OnboardingInput, 'token'>): Promise<void>;
}

export type OnboardingOutcome =
  | { readonly ok: true; readonly record: OnboardingRecord }
  | { readonly ok: false; readonly reason: 'invalid_input' | 'invalid_or_used_token' };

export async function submitOnboarding(deps: OnboardingDeps, raw: unknown): Promise<OnboardingOutcome> {
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { token, ...details } = parsed.data;
  const record = await deps.claimOnboarding(hashOnboardingToken(token), deps.now(), details);
  if (record === null) return { ok: false, reason: 'invalid_or_used_token' };
  try {
    await deps.notifyTicon(record, details);
  } catch {
    // The details are stored; a failed notification must not lose them or fail the buyer.
  }
  return { ok: true, record };
}
