import { motion } from "motion/react";
import type { PipelineStageDefinition } from "@/types/pipeline";

interface Props { stage: PipelineStageDefinition; index: number; active?: boolean; latency?: number; }

export function PipelineStageCard({ stage, index, active = false, latency }: Props) {
  const Icon = stage.icon;
  return (
    <motion.article data-testid="pipeline-stage" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: index * 0.035 }} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 transition ${active ? "border-blue-400 bg-blue-50 shadow-[0_8px_24px_rgba(37,99,235,0.1)]" : "border-slate-200 bg-white"}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><p className={`text-xs font-semibold ${active ? "text-blue-700" : "text-slate-500"}`}>{stage.shortLabel}</p><h3 className="truncate text-sm font-semibold text-slate-950">{stage.label}</h3><p className="mt-0.5 truncate font-mono text-[11px] text-slate-500" title={stage.technology}>{stage.technology}</p></div>
      <span className={`shrink-0 text-xs font-medium ${active ? "text-blue-700" : "text-slate-400"}`}>{active ? "Active" : latency ? `${latency} ms` : "Ready"}</span>
    </motion.article>
  );
}
