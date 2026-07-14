import type { Metadata } from "next";
import { ObstaclesClient } from "./_components/obstacles-client";

export const metadata: Metadata = {
  title: "Obstacle Register — CAAB HCMS",
  description: "Obstacle register — surveyed structures, certified obstacles and complaints",
};

export default function ObstaclesPage() {
  return <ObstaclesClient />;
}
