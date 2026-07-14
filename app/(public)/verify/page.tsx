import type { Metadata } from "next";
import { VerifyClient } from "./verify-client";

export const metadata: Metadata = { title: "Verify Certificate" };

// QR deep links land here as /verify?code=<hc-number-or-token>
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <VerifyClient initialCode={code?.trim() || undefined} />;
}
