import { eventsSecret, marketplaceDeps } from "@/lib/marketplace/deps";
import { handleEvents } from "@/lib/marketplace/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** EventBridge API destination for AWS Marketplace events. See lib/marketplace/http.ts. */
export function POST(request: Request): Promise<Response> {
  return handleEvents(request, marketplaceDeps(), eventsSecret());
}
