// Case detail — workflow stepper, tabs, role-dependent actions.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApplicationDetail } from "./_components/application-detail";

export const metadata: Metadata = {
  title: "Case Detail — CAAB HCMS",
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <ApplicationDetail id={id} />;
}
