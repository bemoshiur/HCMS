import type { Metadata } from "next";
import { AuditClient } from "./_components/audit-client";

export const metadata: Metadata = {
  title: "Audit Trail — CAAB HCMS",
  description: "Immutable, append-only record of every state change and administrative action",
};

export default function AuditPage() {
  return <AuditClient />;
}
