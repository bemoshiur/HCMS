import { marketplaceDeps } from "@/lib/marketplace/deps";
import { handleRegister } from "@/lib/marketplace/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** AWS Marketplace fulfillment URL. See lib/marketplace/http.ts. */
export function POST(request: Request): Promise<Response> {
  return handleRegister(request, marketplaceDeps());
}
