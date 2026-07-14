// Role-aware dashboard — accessible to every signed-in role (§17).
// Auth + role guard handled by app/(app)/layout.tsx; data is scoped
// server-side in GET /api/dashboard.
import type { Metadata } from "next";
import { DashboardClient } from "./_components/dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard — CAAB HCMS",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
