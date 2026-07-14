// Applications list — CAAB case/workflow management (also scoped for
// applicants/authorities who land here via links).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApplicationsList } from "./_components/applications-list";

export const metadata: Metadata = {
  title: "Applications — CAAB HCMS",
};

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <ApplicationsList
      sessionUser={{
        id: session.user.id,
        role: session.user.role,
        name: session.user.name,
      }}
    />
  );
}
