"use client";

// Client wrapper for the landing stats band — icons must live client-side
// (server components cannot pass component functions across the boundary).
import { MapPinned, ShieldCheck, TowerControl, Users } from "lucide-react";
import { Stagger } from "@/components/motion";
import { StatCard } from "@/components/shared/stat-card";

export function StatsBand({
  airportCount,
  obstacleCount,
  certificateCount,
  labels,
}: {
  airportCount: number;
  obstacleCount: number;
  certificateCount: number;
  labels: {
    airports: string;
    airportsHint: string;
    roles: string;
    rolesHint: string;
    register: string;
    registerHint: string;
    certificates: string;
    certificatesHint: string;
  };
}) {
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
      <StatCard label={labels.airports} value={airportCount} icon={TowerControl} hint={labels.airportsHint} />
      <StatCard label={labels.roles} value={11} icon={Users} tone="info" hint={labels.rolesHint} />
      <StatCard label={labels.register} value={obstacleCount} icon={MapPinned} tone="warning" hint={labels.registerHint} />
      <StatCard label={labels.certificates} value={certificateCount} icon={ShieldCheck} tone="success" hint={labels.certificatesHint} />
    </Stagger>
  );
}
