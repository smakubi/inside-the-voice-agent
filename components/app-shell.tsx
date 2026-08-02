"use client";

import { useState } from "react";
import { Activity, AudioWaveform, Braces } from "lucide-react";
import { ArchitectureToggle } from "@/components/architecture-toggle";
import { InspectorDrawer } from "@/components/inspector-drawer";
import { InstructorControls } from "@/components/instructor-controls";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { ScenarioSelector } from "@/components/scenario-selector";
import { TeachingNote } from "@/components/teaching-note";
import { scenarios } from "@/config/scenarios";
import type { ArchitectureMode } from "@/types/pipeline";

export function AppShell() {
  const [architecture, setArchitecture] = useState<ArchitectureMode>("cascaded");
  const [scenarioId, setScenarioId] = useState("general-conversation");
  const [lectureMode, setLectureMode] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [notice, setNotice] = useState("Ready to compare architectures. No live services are connected.");

  function reset() {
    setArchitecture("cascaded");
    setScenarioId("general-conversation");
    setLectureMode(false);
    setInspectorOpen(false);
    setDeveloperMode(false);
    setNotice("Interface reset. No live services are connected.");
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1720px]">
        <header className="flex flex-col gap-5 border-b border-white/8 pb-7 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-sky-300"><AudioWaveform className="size-5" aria-hidden="true" /><span className="text-xs font-semibold tracking-[0.2em] uppercase">Voice systems, revealed</span></div><h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Inside the Voice Agent</h1><p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">See how voice systems listen, reason, and speak—and why architecture changes the experience.</p></div><div className="flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-zinc-400 lg:self-auto"><span className="size-2 rounded-full bg-zinc-500" />Milestone 1 · Static teaching interface</div></header>
        <div className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="grid content-start gap-6"><section className="rounded-2xl border border-white/10 bg-[#111216]/92 p-5"><ArchitectureToggle value={architecture} onChange={setArchitecture} /><div className="my-5 h-px bg-white/8" /><ScenarioSelector scenarios={scenarios} selectedId={scenarioId} onChange={setScenarioId} /></section><InstructorControls lectureMode={lectureMode} inspectorOpen={inspectorOpen} developerMode={developerMode} onLectureModeChange={() => setLectureMode((value) => !value)} onInspectorChange={() => setInspectorOpen((value) => !value)} onDeveloperModeChange={() => setDeveloperMode((value) => !value)} onStart={() => setNotice("Static preview only. Live and fixture execution are intentionally deferred.")} onReset={reset} /><TeachingNote /></aside>
          <div className="min-w-0"><PipelineView architecture={architecture} /><section aria-label="Interface status" className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/20 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Activity className="size-4 shrink-0 text-zinc-500" aria-hidden="true" /><p className="text-zinc-400" aria-live="polite">{notice}</p></div><div className="flex gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${lectureMode ? "bg-amber-300/10 text-amber-200" : "bg-white/5 text-zinc-500"}`}>Lecture {lectureMode ? "on" : "off"}</span><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-500">No API key needed</span></div></section>
            {developerMode ? <section aria-label="Developer event log" className="mt-4 rounded-2xl border border-white/10 bg-[#111216]/92 p-5"><div className="flex items-center gap-2"><Braces className="size-4 text-violet-300" aria-hidden="true" /><h2 className="font-semibold">Developer event log</h2></div><div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-zinc-500">No events yet. Event capture begins with presentation runs in Milestone 2.</div></section> : null}
          </div>
        </div>
      </div>
      <InspectorDrawer open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
    </main>
  );
}
