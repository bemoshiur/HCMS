import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/auth/permissions";
import { SettingsClient } from "./_components/settings-client";

export const metadata: Metadata = {
  title: "Settings — CAAB HCMS",
  description: "Profile preferences and system configuration",
};

export default async function SettingsPage() {
  const session = await auth();
  // The (app) layout already guards authentication; this is a defensive fallback.
  if (!session?.user?.id) redirect("/login");

  const { name, email, role, orgName } = session.user;

  return (
    <SettingsClient
      profile={{ name, email, role, orgName }}
      isAdmin={can(role, "settings.manage")}
    />
  );
}
