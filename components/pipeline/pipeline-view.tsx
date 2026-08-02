import { AnimatePresence, motion } from "motion/react";
import { cascadedStages, realtimeStages } from "@/config/pipelines";
import type { ArchitectureMode } from "@/types/pipeline";
import { PipelineConnector } from "./pipeline-connector";
import { PipelineStageCard } from "./pipeline-stage-card";

const descriptions: Record<ArchitectureMode, string> = {
  cascaded: "Each capability is handled by a separate component. The pipeline is modular and inspectable, but every handoff adds latency and can lose information.",
  realtime: "A single multimodal model processes audio in and audio out. The experience can feel more natural, but the internal process is less exposed.",
};

export function PipelineView({ architecture }: { architecture: ArchitectureMode }) {
  const stages = architecture === "cascaded" ? cascadedStages : realtimeStages;
  return (
    <section aria-labelledby="pipeline-heading" className="overflow-hidden rounded-3xl border border-white/10 bg-[#101115]/92 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-5 sm:px-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold tracking-[0.18em] text-sky-300/70 uppercase">System map</p><h2 id="pipeline-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{architecture === "cascaded" ? "A chain of specialized systems" : "One native audio system"}</h2></div><p className="max-w-2xl text-sm leading-6 text-zinc-400">{descriptions[architecture]}</p></div>
      <AnimatePresence mode="wait" initial={false}><motion.div key={architecture} initial={{ opacity: 0, x: architecture === "realtime" ? 24 : -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: architecture === "realtime" ? -24 : 24 }} transition={{ duration: 0.3 }} className="flex flex-col p-5 sm:p-7 lg:flex-row lg:items-stretch">{stages.map((stage, index) => <div className="contents" key={stage.id}><PipelineStageCard stage={stage} index={index} emphasized={stage.id === "realtime-model"} />{index < stages.length - 1 ? <PipelineConnector /> : null}</div>)}</motion.div></AnimatePresence>
      {architecture === "realtime" ? <p className="mx-5 mb-5 rounded-xl border border-sky-300/15 bg-sky-300/[0.045] px-4 py-3 text-sm leading-6 text-zinc-400 sm:mx-7 sm:mb-7"><span className="font-semibold text-sky-200">Important distinction:</span> A transcript may be generated for inspection, but the native audio model is not limited to reasoning over that transcript.</p> : null}
    </section>
  );
}
