"use client";

// Notifications centre — In-app list + mocked Email/SMS delivery log.
import * as React from "react";
import { Inbox, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageTransition } from "@/components/motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/components/providers";
import { InAppTab } from "./inapp-tab";
import { DeliveryLogTab } from "./delivery-log-tab";

export function NotificationsCenter() {
  const t = useT();

  return (
    <PageTransition>
      <PageHeader
        title={t("nav.notifications")}
        description="Your in-app alerts and a visible record of the email & SMS messages the system dispatched to you."
        crumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("nav.notifications") }]}
      />

      <Tabs defaultValue="inapp">
        <TabsList>
          <TabsTrigger value="inapp">
            <Inbox className="size-4" aria-hidden /> In-app
          </TabsTrigger>
          <TabsTrigger value="log">
            <Send className="size-4" aria-hidden /> Delivery log
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inapp" className="mt-4">
          <InAppTab />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <DeliveryLogTab />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
