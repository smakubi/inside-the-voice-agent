import type { LucideIcon } from "lucide-react";

export type ArchitectureMode = "cascaded" | "realtime";
export type StageStatus = "idle" | "ready" | "running" | "paused" | "complete" | "error";

export interface PipelineStageDefinition {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  placeholderLatency: string;
  status: StageStatus;
  icon: LucideIcon;
}
