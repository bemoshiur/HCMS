"use client";

// Master data management (brief §17) — ADMIN only.
// Tabs: Airports | Structure Types | Authorities | Fees.
import * as React from "react";
import { Building2, DatabaseZap, Landmark, Receipt, Shapes } from "lucide-react";
import { PageTransition } from "@/components/motion";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/components/providers";
import { AirportsTab } from "./airports-tab";
import { StructureTypesTab } from "./structure-types-tab";
import { AuthoritiesTab } from "./authorities-tab";
import { FeesTab } from "./fees-tab";

export function MasterDataClient() {
  const t = useT();
  const [tab, setTab] = React.useState("airports");

  return (
    <PageTransition className="p-4 md:p-6">
      <PageHeader
        crumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("nav.masterData") }]}
        title={t("nav.masterData")}
        description="Reference data behind every evaluation — airports, runways, navaids and OLS parameters, plus structure types, approving authorities and the fee schedule."
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="airports">
            <Building2 className="size-4" aria-hidden />
            Airports
          </TabsTrigger>
          <TabsTrigger value="structure-types">
            <Shapes className="size-4" aria-hidden />
            Structure Types
          </TabsTrigger>
          <TabsTrigger value="authorities">
            <Landmark className="size-4" aria-hidden />
            Authorities
          </TabsTrigger>
          <TabsTrigger value="fees">
            <Receipt className="size-4" aria-hidden />
            Fees
          </TabsTrigger>
        </TabsList>

        <TabsContent value="airports">
          {tab === "airports" && <AirportsTab />}
        </TabsContent>
        <TabsContent value="structure-types">
          {tab === "structure-types" && <StructureTypesTab />}
        </TabsContent>
        <TabsContent value="authorities">
          {tab === "authorities" && <AuthoritiesTab />}
        </TabsContent>
        <TabsContent value="fees">
          {tab === "fees" && <FeesTab />}
        </TabsContent>
      </Tabs>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <DatabaseZap className="size-3.5" aria-hidden />
        Reference figures — confirm all values against the CAAB AIP before activation.
      </p>
    </PageTransition>
  );
}
