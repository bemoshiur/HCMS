import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { canAccessRoute } from "@/lib/auth/permissions";
import { AppShell, type ShellUser } from "@/components/app-shell/shell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Authoritative per-route role guard (middleware only checks cookie presence)
  const headerList = await headers();
  const pathname =
    headerList.get("x-invoke-path") ?? headerList.get("x-pathname") ?? null;
  if (pathname && !canAccessRoute(session.user.role, pathname)) {
    redirect("/dashboard");
  }

  const user: ShellUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    orgName: session.user.orgName,
  };

  return <AppShell user={user}>{children}</AppShell>;
}
