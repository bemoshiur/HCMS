// New application wizard — 5 steps (applicant, site, structure, documents,
// review & submit). Draft is created server-side so uploads can attach.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NewApplicationWizard } from "./_components/wizard";

export const metadata: Metadata = {
  title: "New Application — CAAB HCMS",
};

export default async function NewApplicationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <NewApplicationWizard
      sessionUser={{
        name: session.user.name,
        email: session.user.email,
        orgName: session.user.orgName,
      }}
    />
  );
}
