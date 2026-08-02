import { motion } from "motion/react";
import type { PipelineStageDefinition } from "@/types/pipeline";

interface Props { stage: PipelineStageDefinition; index: number; active?: boolean; latency?: number; }

export function PipelineStageCard({ stage, index, active = false, latency }: Props) {
  const Icon = stage.icon;
  return (
    <motion.article data-testid="pipeline-stage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: index * 0.04 }} className={`flex min-h-36 min-w-0 flex-1 flex-col rounded-2xl border p-4 transition ${active ? "border-blue-400 bg-blue-50 shadow-[0_10px_30px_rgba(37,99,235,0.12)]" : "border-slate-200 bg-slate-50/70"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`grid size-9 place-items-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"}`}><Icon className="size-4" aria-hidden="true" /></span>
        <span className={`text-xs font-medium ${active ? "text-blue-700" : "text-slate-400"}`}>{active ? "Working" : latency ? `${latency} ms` : "Ready"}</span>
      </div>
      <div className="mt-5"><p className="text-xs font-semibold text-blue-700">{stage.shortLabel}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{stage.label}</h3><p className="mt-1.5 text-xs leading-5 text-slate-500">{stage.description}</p></div>
    </motion.article>
  );
}
