import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";

// Landing page for AWS Marketplace buyers. /api/aws/register sends the buyer here
// with a one-time onboarding token in the URL fragment (#t=…); the form posts it,
// with the buyer's contact details, to /api/aws/onboarding.
export const metadata: Metadata = {
  title: "Welcome, AWS Marketplace customer",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const MESSAGES: Record<string, { tone: "ok" | "warn"; en: string; bn: string }> = {
  received: {
    tone: "ok",
    en: "Thank you. TiCON System Limited has your details and will contact you within one business day to provision your HCMS environment.",
    bn: "ধন্যবাদ। TiCON System Limited আপনার তথ্য পেয়েছে এবং আপনার HCMS এনভায়রনমেন্ট চালু করতে এক কর্মদিবসের মধ্যে যোগাযোগ করবে।",
  },
  invalid: {
    tone: "warn",
    en: "Some details were missing or not in the expected format. Please go back and check the form.",
    bn: "কিছু তথ্য অনুপস্থিত বা সঠিক ফরম্যাটে নেই। অনুগ্রহ করে ফর্মটি আবার দেখুন।",
  },
  expired: {
    tone: "warn",
    en: "This setup link has expired or was already used. Open HCMS again from AWS Marketplace → Manage subscriptions, or email business@ticonsys.com.",
    bn: "এই সেটআপ লিংকের মেয়াদ শেষ অথবা আগে ব্যবহার হয়েছে। AWS Marketplace → Manage subscriptions থেকে আবার খুলুন, অথবা business@ticonsys.com এ ইমেইল করুন।",
  },
};

export default async function AwsWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const msg = status ? MESSAGES[status] : undefined;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AWS Marketplace</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome to HCMS</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your subscription is confirmed with AWS. Tell us who to work with and we will set up your height
        clearance environment.
      </p>
      {msg ? (
        <div
          role="status"
          className={`mt-6 rounded-lg border p-4 text-sm ${msg.tone === "ok" ? "border-emerald-600/40" : "border-amber-600/40"}`}
        >
          <p>{msg.en}</p>
          <p lang="bn" className="mt-2 text-muted-foreground">
            {msg.bn}
          </p>
        </div>
      ) : null}
      {status === "received" ? null : <OnboardingForm />}
    </main>
  );
}
