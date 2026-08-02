import { motion } from "motion/react";
import type { PipelineStageDefinition } from "@/types/pipeline";

interface Props { stage: PipelineStageDefinition; index: number; emphasized?: boolean; }

export function PipelineStageCard({ stage, index, emphasized = false }: Props) {
  const Icon = stage.icon;
  return (
    <motion.article data-testid="pipeline-stage" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: index * 0.055 }} className={`relative flex min-h-52 min-w-0 flex-1 flex-col rounded-2xl border p-5 ${emphasized ? "border-sky-400/35 bg-sky-400/[0.075] shadow-[0_0_50px_rgb(56_189_248/0.08)] lg:min-h-60 lg:flex-[1.35]" : "border-white/10 bg-white/[0.035]"}`}>
      <div className="flex items-start justify-between gap-3"><span className={`grid size-10 place-items-center rounded-xl border ${emphasized ? "border-sky-300/25 bg-sky-300/10 text-sky-200" : "border-white/10 bg-black/30 text-zinc-300"}`}><Icon className="size-5" aria-hidden="true" /></span><span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{stage.status}</span></div>
      <div className="mt-6"><p className="text-[11px] font-semibold tracking-[0.16em] text-sky-300/70 uppercase">{stage.shortLabel}</p><h3 className="mt-2 text-lg font-semibold tracking-tight text-white">{stage.label}</h3><p className="mt-2 text-sm leading-5 text-zinc-400">{stage.description}</p></div>
      <div className="mt-auto flex items-end justify-between border-t border-white/8 pt-4"><span className="text-xs text-zinc-600">Latency</span><span className="font-mono text-sm text-zinc-400">{stage.placeholderLatency}</span></div>
    </motion.article>
  );
}
