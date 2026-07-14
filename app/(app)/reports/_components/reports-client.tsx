"use client";

/**
 * Reports & analytics workspace (§17, deep-analytics half) —
 * Tabs: Analytics | Report Builder | Penetration Map.
 * All data is role-scoped server-side by /api/reports/*.
 */
import * as React from "react";
import { BarChart3, MapPinned, Table2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { useT } from "@/components/providers";
import { AnalyticsTab } from "./analytics-tab";
import { ReportBuilderTab } from "./report-builder-tab";
import { PenetrationMapTab } from "./penetration-map-tab";
import type { AnalyticsFilters } from "./types";

export function ReportsClient() {
  const t = useT();
  const [tab, setTab] = React.useState("analytics");
  const [filters, setFilters] = React.useState<AnalyticsFilters>({
    icao: "",
    from: "",
    to: "",
  });

  return (
    <PageTransition className="space-y-4">
      <PageHeader
        className="mb-4"
        title={t("nav.reports")}
        description="Throughput, outcomes, turnaround and SLA analytics, an ad-hoc report builder with CSV, Excel and PDF export, and the OLS penetration map."
        crumbs={[{ label: t("nav.insight") }, { label: t("nav.reports") }]}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label={t("nav.reports")}>
          <TabsTrigger value="analytics" className="px-3">
            <BarChart3 aria-hidden />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="builder" className="px-3">
            <Table2 aria-hidden />
            Report Builder
          </TabsTrigger>
          <TabsTrigger value="penetration" className="px-3">
            <MapPinned aria-hidden />
            Penetration Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-2 focus-visible:outline-none">
          <AnalyticsTab filters={filters} onFiltersChange={setFilters} />
        </TabsContent>
        <TabsContent value="builder" className="mt-2 focus-visible:outline-none">
          <ReportBuilderTab />
        </TabsContent>
        <TabsContent value="penetration" className="mt-2 focus-visible:outline-none">
          <PenetrationMapTab />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
