import { registerFromToken, type MarketplaceDeps } from "./register";
import { handleMarketplaceEvent, InvalidEventError, secretMatches } from "./events";
import { submitOnboarding, type OnboardingDeps } from "./onboarding";

/**
 * AWS Marketplace endpoints as plain (Request, deps) → Response functions, so the
 * Next route files stay one line and these stay testable without a server.
 *
 *   POST /api/aws/register    fulfillment URL (form: x-amzn-marketplace-token)
 *   POST /api/aws/events      EventBridge agreement + license events (JSON)
 *   POST /api/aws/onboarding  buyer contact details (form, one-time token)
 *
 * Nothing trusts its caller: the registration token is resolved server-side with
 * AWS, events need the shared-secret header and are re-checked with GetEntitlements,
 * and the onboarding form needs a single-use token.
 */

export const EVENTS_SECRET_HEADER = "x-ticon-mp-secret";
const MAX_EVENT_BODY = 256 * 1024;

const notFound = () => new Response(null, { status: 404 });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const redirect = (location: string) =>
  new Response(null, {
    status: 303,
    headers: { location, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });

function formString(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === "string" ? v : undefined;
}

function failurePage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>HCMS · AWS Marketplace</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>We could not confirm this AWS Marketplace purchase</h1>
<p lang="bn">এই AWS Marketplace ক্রয়টি নিশ্চিত করা যায়নি।</p>
<p>The registration link may have expired or already been used. Open HCMS again from <strong>AWS Marketplace → Manage subscriptions → Set up product</strong>, or write to <a href="mailto:business@ticonsys.com">business@ticonsys.com</a> and we will finish the setup with you.</p>
</body></html>`;
}

export async function handleRegister(req: Request, deps: MarketplaceDeps | null): Promise<Response> {
  if (!deps) return notFound();
  let token: string | undefined;
  try {
    token = formString(await req.formData(), "x-amzn-marketplace-token");
  } catch {
    token = undefined;
  }
  const out = await registerFromToken(deps, token);
  if (!out.ok) {
    console.warn(JSON.stringify({ event: "aws_mp_register_refused", reason: out.reason }));
    return new Response(failurePage(), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  // The onboarding token travels in the URL fragment, which browsers never send to a
  // server, so it stays out of every access log and Referer header.
  return redirect(`/aws/welcome#t=${encodeURIComponent(out.onboardingToken)}`);
}

export async function handleEvents(
  req: Request,
  deps: MarketplaceDeps | null,
  secret: string | null
): Promise<Response> {
  if (!deps || !secret) return notFound();
  if (!secretMatches(secret, req.headers.get(EVENTS_SECRET_HEADER) ?? undefined)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (Number(req.headers.get("content-length") ?? "0") > MAX_EVENT_BODY) return json({ error: "too_large" }, 413);
  const text = await req.text();
  if (text.length > MAX_EVENT_BODY) return json({ error: "too_large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "not_json" }, 400);
  }
  try {
    const result = await handleMarketplaceEvent(deps, body);
    console.info(JSON.stringify({ event: "aws_mp_event_handled", result }));
    return json({ ok: true, result });
  } catch (err) {
    if (err instanceof InvalidEventError) return json({ error: `invalid_${err.message}` }, 400);
    console.error(JSON.stringify({ event: "aws_mp_event_failed", error: String(err) }));
    // 5xx makes the API destination retry (EventBridge retries for up to 24 h).
    return json({ error: "handler_failed" }, 500);
  }
}

export async function handleOnboarding(req: Request, deps: OnboardingDeps | null): Promise<Response> {
  if (!deps) return notFound();
  let raw: Record<string, string | undefined> = {};
  try {
    const form = await req.formData();
    raw = {
      token: formString(form, "token"),
      organisationName: formString(form, "organisationName"),
      contactName: formString(form, "contactName"),
      contactEmail: formString(form, "contactEmail"),
      contactPhone: formString(form, "contactPhone"),
      country: formString(form, "country"),
    };
  } catch {
    // Falls through to invalid_input.
  }
  const out = await submitOnboarding(deps, raw);
  if (out.ok) return redirect("/aws/welcome?status=received");
  return redirect(`/aws/welcome?status=${out.reason === "invalid_input" ? "invalid" : "expired"}`);
}
