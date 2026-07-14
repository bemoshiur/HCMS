import type { Metadata } from "next";
import { UsersClient } from "./_components/users-client";

export const metadata: Metadata = {
  title: "Users — CAAB HCMS",
  description: "User and role management — accounts, roles, organizations and access",
};

export default function UsersPage() {
  return <UsersClient />;
}
