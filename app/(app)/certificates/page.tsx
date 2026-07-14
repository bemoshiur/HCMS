import type { Metadata } from "next";
import { CertificatesClient } from "./_components/certificates-client";

export const metadata: Metadata = {
  title: "Certificates — CAAB HCMS",
  description: "Height clearance certificate register and lifecycle management",
};

export default function CertificatesPage() {
  return <CertificatesClient />;
}
