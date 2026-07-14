// Approving authority workspace — jurisdiction dashboard + endorsement queue.
// Role access (/authority → AUTHORITY_OFFICER) is enforced by the (app) layout.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthorityWorkspace } from "./_components/authority-workspace";

export const metadata: Metadata = {
  title: "Authority Workspace — CAAB HCMS",
};

export default async function AuthorityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <AuthorityWorkspace
      orgName={session.user.orgName}
      jurisdiction={session.user.jurisdiction}
    />
  );
}
