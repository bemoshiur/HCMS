import type { Metadata } from "next";
import { MasterDataClient } from "./_components/master-data-client";

export const metadata: Metadata = {
  title: "Master Data — CAAB HCMS",
  description: "Airports, runways, navaids, OLS parameters, structure types, authorities and fees",
};

export default function MasterDataPage() {
  return <MasterDataClient />;
}
