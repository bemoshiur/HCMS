// Reports & analytics — accessible to every signed-in role (§17).
// Auth handled by app/(app)/layout.tsx; all figures are role-scoped
// server-side in /api/reports/analytics and /api/reports/build.
import type { Metadata } from "next";
import { ReportsClient } from "./_components/reports-client";

export const metadata: Metadata = {
  title: "Reports — CAAB HCMS",
};

export default function ReportsPage() {
  return <ReportsClient />;
}
