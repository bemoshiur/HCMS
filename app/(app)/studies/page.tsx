import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudiesList } from "./_components/studies-list";

export const metadata: Metadata = { title: "Aeronautical Studies" };

export default async function StudiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!["STUDY_OFFICER", "APPROVER", "ADMIN", "AUDITOR"].includes(session.user.role)) {
    redirect("/dashboard");
  }
  return <StudiesList />;
}
