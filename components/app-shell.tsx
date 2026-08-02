"use client";

import { useState } from "react";
import { AudioWaveform, CheckCircle2, ChevronDown, Sparkles } from "lucide-react";
import { ArchitectureToggle } from "@/components/architecture-toggle";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { ScenarioSelector } from "@/components/scenario-selector";
import { VoiceConsole, type VoiceStage } from "@/components/voice-console";
import { scenarios } from "@/config/scenarios";
import type { ArchitectureMode } from "@/types/pipeline";

export function AppShell() {
  const [architecture, setArchitecture] = useState<ArchitectureMode>("cascaded");
  const [scenarioId, setScenarioId] = useState("general-conversation");
  const [activeStage, setActiveStage] = useState<VoiceStage>("idle");
  const [timings, setTimings] = useState<Record<string, number>>({});

  function updateTiming(stage: string, duration: number) {
    setTimings((current) => ({ ...current, [stage]: duration }));
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><AudioWaveform className="size-5" aria-hidden="true" /></span>
            <span className="font-semibold tracking-[-0.02em] text-slate-950">Inside the Voice Agent</span>
          </div>
          <span className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><span className="size-2 rounded-full bg-emerald-500" />Voice service ready</span>
        </header>

        <section className="pb-10 pt-14 text-center sm:pb-12 sm:pt-20">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><Sparkles className="size-3.5" />Speak with the system, then see how it works</div>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl">A voice agent you can actually talk to.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Ask a question out loud. The app shows each step from microphone to spoken answer without burying you in controls.</p>
        </section>

        <VoiceConsole scenarioId={scenarioId} onStageChange={setActiveStage} onTiming={updateTiming} />

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
            <ArchitectureToggle value={architecture} onChange={setArchitecture} />
            <ScenarioSelector scenarios={scenarios} selectedId={scenarioId} onChange={setScenarioId} />
          </div>
          <div className="mt-7 border-t border-slate-100 pt-7">
            <PipelineView architecture={architecture} activeStage={activeStage} timings={timings} />
          </div>
        </section>

        <details className="group mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">What do I need to run this?<ChevronDown className="size-4 transition group-open:rotate-180" /></summary>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2">
            <p className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />Allow microphone access when your browser asks.</p>
            <p className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />The OpenAI key stays on the server and is never sent to your browser.</p>
          </div>
        </details>

        <footer className="py-10 text-center text-xs text-slate-400">Built to make voice systems easier to understand.</footer>
      </div>
    </main>
  );
}
