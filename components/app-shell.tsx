"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { VoiceConsole } from "@/components/voice-console";
import { SiteHeader } from "@/components/site-header";
import type { ArchitectureMode } from "@/types/pipeline";

export function AppShell() {
  const [architecture, setArchitecture] = useState<ArchitectureMode>("cascaded");

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <SiteHeader showStatus />

        <section className="pb-9 pt-12 sm:pb-10 sm:pt-16">
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">Voice Agent Demo</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Speak with the agent and follow the active voice-processing stage in real time.</p>
        </section>

        <VoiceConsole architecture={architecture} onArchitectureChange={setArchitecture} />

        <details className="group mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">What do I need to run this?<ChevronDown className="size-4 transition group-open:rotate-180" /></summary>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2">
            <p className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />Allow microphone access when your browser asks.</p>
            <p className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />The OpenAI key stays on the server and is never sent to your browser.</p>
          </div>
        </details>

        <footer className="py-10 text-center text-xs text-slate-400">Inside the Voice Agent</footer>
      </div>
    </main>
  );
}
