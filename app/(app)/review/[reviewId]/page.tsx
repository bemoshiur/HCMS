// Review console — map + automatic assessment + verdict form for one
// discipline review.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { reviewerDiscipline } from "@/lib/auth/permissions";
import { ReviewConsole } from "./_components/review-console";

export const metadata: Metadata = {
  title: "Review Console — CAAB HCMS",
};

export default async function ReviewConsolePage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!reviewerDiscipline(session.user.role)) redirect("/dashboard");

  return <ReviewConsole reviewId={reviewId} />;
}
