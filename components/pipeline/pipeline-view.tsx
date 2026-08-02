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

export function PipelineView({ architecture, activeStage, timings }: { architecture: ArchitectureMode; activeStage: VoiceStage; timings: Record<string, number> }) {
  const stages = architecture === "cascaded" ? cascadedStages : realtimeStages;
  const activeId = architecture === "realtime" && activeStage !== "idle" && activeStage !== "error" ? "realtime-model" : activeStageMap[activeStage];

  return (
    <section aria-labelledby="pipeline-heading">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Live pipeline</p>
        <h2 id="pipeline-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">{architecture === "cascaded" ? "Cascaded processing" : "Speech-to-speech processing"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{architecture === "cascaded" ? "Watch the active handoff while the agent works." : "The multimodal model handles the live audio loop."}</p>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={architecture} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-5 grid gap-2">
          {stages.map((pipelineStage, index) => <PipelineStageCard key={pipelineStage.id} stage={pipelineStage} index={index} active={pipelineStage.id === activeId} latency={timings[pipelineStage.id]} />)}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
