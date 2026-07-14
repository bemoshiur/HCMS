// Discipline review console — per-discipline queue (AGA / CNS / PANS-OPS).
// The discipline is derived from the signed-in reviewer's role.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { reviewerDiscipline } from "@/lib/auth/permissions";
import { ReviewQueue } from "./_components/review-queue";

export const metadata: Metadata = {
  title: "Discipline Review — CAAB HCMS",
};

export default async function ReviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const discipline = reviewerDiscipline(session.user.role);
  if (!discipline) redirect("/dashboard");

  return <ReviewQueue discipline={discipline} />;
}
