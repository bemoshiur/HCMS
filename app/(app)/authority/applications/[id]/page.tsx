// Authority case detail — endorse & forward to CAAB or return to applicant.
// Other modules deep-link to this exact path for AUTHORITY_OFFICER users.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthorityCaseDetail } from "./_components/authority-case-detail";

export const metadata: Metadata = {
  title: "Authority Case — CAAB HCMS",
};

export default async function AuthorityApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <AuthorityCaseDetail id={id} />;
}
