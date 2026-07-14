import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NotificationsCenter } from "./_components/notifications-center";

export const metadata: Metadata = { title: "Notifications" };

// All roles see their own notifications (route access already allows ALL_ROLES).
export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <NotificationsCenter />;
}
