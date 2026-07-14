"use client";

// Settings shell — Profile tab for every role; System tab gated to ADMIN.
// The page itself is reachable by all roles (per ROUTE_ACCESS); non-admins see
// an access notice in place of the system controls.
import * as React from "react";
import { Lock, SlidersHorizontal, UserRound } from "lucide-react";
import { PageTransition } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/components/providers";
import { ProfileTab } from "./profile-tab";
import { SystemTab } from "./system-tab";
import type { ProfileInfo } from "./types";

export function SettingsClient({
  profile,
  isAdmin,
}: {
  profile: ProfileInfo;
  isAdmin: boolean;
}) {
  const t = useT();
  const [tab, setTab] = React.useState("profile");

  return (
    <PageTransition className="p-4 md:p-6">
      <PageHeader
        crumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.settings") },
        ]}
        title={t("nav.settings")}
        description="Manage your profile and language preferences. Administrators can configure system-wide policy here."
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList>
          <TabsTrigger value="profile">
            <UserRound className="size-4" aria-hidden />
            {t("common.profile")}
          </TabsTrigger>
          <TabsTrigger value="system">
            <SlidersHorizontal className="size-4" aria-hidden />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab profile={profile} />
        </TabsContent>

        <TabsContent value="system">
          {isAdmin ? (
            <SystemTab />
          ) : (
            <EmptyState
              icon={Lock}
              title="Administrator access required"
              description="System configuration is restricted to administrators. Your profile settings are available in the Profile tab."
            />
          )}
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
