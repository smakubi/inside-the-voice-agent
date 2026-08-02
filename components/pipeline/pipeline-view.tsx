import { AnimatePresence, motion } from "motion/react";
import { cascadedStages, realtimeStages } from "@/config/pipelines";
import type { VoiceStage } from "@/components/voice-console";
import type { ArchitectureMode } from "@/types/pipeline";
import { PipelineConnector } from "./pipeline-connector";
import { PipelineStageCard } from "./pipeline-stage-card";

const activeStageMap: Partial<Record<VoiceStage, string>> = {
  listening: "user-audio",
  transcribing: "speech-to-text",
  thinking: "language-model",
  speaking: "text-to-speech",
};

export function PipelineView({ architecture, activeStage, timings }: { architecture: ArchitectureMode; activeStage: VoiceStage; timings: Record<string, number> }) {
  const stages = architecture === "cascaded" ? cascadedStages : realtimeStages;
  const activeId = architecture === "realtime" && activeStage !== "idle" ? "realtime-model" : activeStageMap[activeStage];

  return (
    <section aria-labelledby="pipeline-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-blue-700">Under the hood</p><h2 id="pipeline-heading" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{architecture === "cascaded" ? "Four handoffs create the answer" : "One model handles the conversation"}</h2></div>
        <p className="max-w-lg text-sm leading-6 text-slate-500">{architecture === "cascaded" ? "The live demo uses separate speech, reasoning, and voice models." : "Realtime systems can listen and speak in one continuous low-latency session."}</p>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={architecture} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-6 flex flex-col lg:flex-row lg:items-stretch">
          {stages.map((stage, index) => <div className="contents" key={stage.id}><PipelineStageCard stage={stage} index={index} active={stage.id === activeId} latency={timings[stage.id]} />{index < stages.length - 1 ? <PipelineConnector /> : null}</div>)}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
