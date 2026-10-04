import type { LucideIcon } from "lucide-react";

export type ArchitectureMode = "cascaded" | "realtime" | "live";
export type StageStatus = "idle" | "ready" | "running" | "paused" | "complete" | "error";

export interface PipelineStageDefinition {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  technology: string;
  metricLabel: "Duration" | "Latency" | "First text" | "First audio bytes" | "Session duration";
  placeholderLatency: string;
  status: StageStatus;
  icon: LucideIcon;
}
