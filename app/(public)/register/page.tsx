import type { Metadata } from "next";
import { RegisterClient } from "./register-client";

export const metadata: Metadata = { title: "Public Register" };

export default function PublicRegisterPage() {
  return <RegisterClient />;
}
