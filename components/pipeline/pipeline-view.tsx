import { AnimatePresence, motion } from "motion/react";
import { cascadedStages, realtimeStages } from "@/config/pipelines";
import type { VoiceStage } from "@/components/voice-console";
import type { ArchitectureMode } from "@/types/pipeline";
import { PipelineStageCard } from "./pipeline-stage-card";

const activeStageMap: Partial<Record<VoiceStage, string>> = {
  listening: "user-audio",
  transcribing: "speech-to-text",
  thinking: "language-model",
  speaking: "text-to-speech",
};

export function PipelineView({ architecture, activeStage, timings, selectedStageId, onStageSelect }: { architecture: ArchitectureMode; activeStage: VoiceStage; timings: Record<string, number>; selectedStageId?: string; onStageSelect: (stageId: string) => void }) {
  const stages = architecture === "cascaded" ? cascadedStages : realtimeStages;
  const activeId = architecture === "cascaded"
    ? activeStageMap[activeStage]
    : activeStage === "listening"
      ? "user-audio"
      : activeStage === "speaking"
        ? "assistant-audio"
        : activeStage !== "idle" && activeStage !== "error"
          ? "realtime-model"
          : undefined;

  return (
    <section aria-labelledby="pipeline-heading">
      <div>
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Pipeline</p><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Live stack</span></div>
        <h2 id="pipeline-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">{architecture === "cascaded" ? "Cascaded processing" : "Speech-to-speech processing"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{architecture === "cascaded" ? "Text and speech stream together. First text and first audio bytes measure startup, not total generation time." : "Audio travels over WebRTC, with live web search available for current facts."} Completed steps distinguish processing latency from audio duration. Click any step to inspect its Python equivalent.</p>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={architecture} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-5 grid gap-2">
          {stages.map((pipelineStage, index) => <PipelineStageCard key={pipelineStage.id} stage={pipelineStage} index={index} active={pipelineStage.id === activeId} selected={pipelineStage.id === selectedStageId} latency={timings[pipelineStage.id]} onSelect={() => onStageSelect(pipelineStage.id)} />)}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
