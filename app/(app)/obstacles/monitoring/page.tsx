import type { Metadata } from "next";
import { MonitoringBoard } from "./_components/monitoring-board";

export const metadata: Metadata = {
  title: "Obstacle Monitoring — CAAB HCMS",
  description: "Monitoring board for flagged structures — penetrating, under monitoring and illegal obstacles.",
};

export default function MonitoringPage() {
  return <MonitoringBoard />;
}
