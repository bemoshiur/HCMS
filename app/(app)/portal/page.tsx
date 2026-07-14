// Applicant portal dashboard — own applications, KPIs and attention banner.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalDashboard } from "./_components/portal-dashboard";

export const metadata: Metadata = {
  title: "My Applications — CAAB HCMS",
};

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <PortalDashboard
      userName={session.user.name}
      orgName={session.user.orgName}
    />
  );
}
