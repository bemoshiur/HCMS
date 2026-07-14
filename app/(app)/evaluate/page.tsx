import type { Metadata } from "next";
import { EvaluateScreen } from "./_components/evaluate-screen";

export const metadata: Metadata = {
  title: "OLS Evaluation — CAAB HCMS",
};

// Map-centric OLS evaluation screen (brief §17). Auth + role gating is
// handled by app/(app)/layout.tsx via ROUTE_ACCESS["/evaluate"].
export default async function EvaluatePage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const { app } = await searchParams;
  return <EvaluateScreen applicationId={app ?? null} />;
}
