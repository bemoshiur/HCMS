import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudyWorkspace } from "./_components/study-workspace";

export const metadata: Metadata = { title: "Study Workspace" };

export default async function StudyWorkspacePage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!["STUDY_OFFICER", "APPROVER", "ADMIN", "AUDITOR"].includes(session.user.role)) {
    redirect("/dashboard");
  }
  return <StudyWorkspace studyId={studyId} />;
}
