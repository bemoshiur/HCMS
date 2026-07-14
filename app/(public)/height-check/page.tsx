import type { Metadata } from "next";
import { HeightCheckClient } from "./height-check-client";

export const metadata: Metadata = { title: "Height Check" };

export default function HeightCheckPage() {
  return <HeightCheckClient />;
}
