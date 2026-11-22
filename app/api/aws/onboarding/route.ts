import { onboardingDeps } from "@/lib/marketplace/deps";
import { handleOnboarding } from "@/lib/marketplace/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Buyer contact details after an AWS Marketplace purchase. See lib/marketplace/http.ts. */
export function POST(request: Request): Promise<Response> {
  return handleOnboarding(request, onboardingDeps());
}
