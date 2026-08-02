"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { ArchitectureToggle } from "@/components/architecture-toggle";
import { PythonCode } from "@/components/python-code";
import { getCodeSnippet } from "@/config/code-snippets";
import { cascadedStages, realtimeStages } from "@/config/pipelines";
import type { ArchitectureMode } from "@/types/pipeline";

const walkthroughs = {
  cascaded: [
    ["Start with the browser", "Show how MediaRecorder and silence detection define one user turn."],
    ["Trace the three APIs", "Follow the recording through transcription, reasoning, and synthesis."],
    ["Compare the timings", "Separate audio duration from processing latency at every boundary."],
    ["Discuss control", "Point out where transcripts, model choice, and exact spoken wording can be inspected."],
  ],
  realtime: [
    ["Open one connection", "Show how the microphone and remote audio share a WebRTC session."],
    ["Follow model events", "Trace speech detection, response creation, audio deltas, and transcripts."],
    ["Inspect tool use", "Explain how current-fact questions call web search over the data channel."],
    ["Compare architectures", "Contrast natural turn-taking with the observability of the cascaded path."],
  ],
} satisfies Record<ArchitectureMode, string[][]>;

export function ArchitectureExplorer() {
  const [architecture, setArchitecture] = useState<ArchitectureMode>("cascaded");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const stages = architecture === "cascaded" ? cascadedStages : realtimeStages;
  const selectedStage = stages[selectedIndex];
  const snippet = getCodeSnippet(architecture, selectedStage.id);

  function changeArchitecture(nextArchitecture: ArchitectureMode) {
    setArchitecture(nextArchitecture);
    setSelectedIndex(0);
    setCopied(false);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <>
      <section className="grid gap-8 border-y border-slate-200 py-10 lg:grid-cols-[17rem_1fr]">
        <div>
          <p className="text-sm font-medium text-slate-500">Execution graph</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Follow one voice turn</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Switch architectures, then select each node to connect the runtime flow to its Python equivalent.</p>
          <div className="mt-6"><ArchitectureToggle value={architecture} onChange={changeArchitecture} /></div>
        </div>

        <div className="min-w-0">
          <div className="grid gap-2" aria-label={`${architecture === "cascaded" ? "Cascaded" : "Speech-to-speech"} execution flow`}>
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const selected = index === selectedIndex;
              return (
                <div key={stage.id}>
                  <button type="button" onClick={() => setSelectedIndex(index)} aria-pressed={selected} className={`grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 border px-4 py-3 text-left transition ${selected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <span className={`grid size-10 place-items-center ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block text-xs font-medium text-slate-500">{String(index + 1).padStart(2, "0")} · {stage.shortLabel}</span><span className="block font-semibold text-slate-950">{stage.label}</span><span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">{stage.technology}</span></span>
                    <span className="hidden text-xs font-medium text-slate-400 sm:block">View code</span>
                  </button>
                  {index < stages.length - 1 ? <div className="ml-5 h-5 border-l border-slate-300" aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-12 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-labelledby="code-heading">
        <div>
          <p className="text-sm font-medium text-slate-500">Component sequence</p>
          <h2 id="code-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Teach it step by step</h2>
          <div className="mt-6 border-t border-slate-200">
            {stages.map((stage, index) => (
              <button key={stage.id} type="button" onClick={() => setSelectedIndex(index)} className={`flex w-full items-center justify-between gap-3 border-b border-slate-200 py-3 text-left text-sm ${index === selectedIndex ? "font-semibold text-blue-700" : "text-slate-600 hover:text-slate-950"}`}>
                <span>{String(index + 1).padStart(2, "0")} · {stage.label}</span><ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <article className="min-w-0 overflow-hidden border border-slate-200 bg-white">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div><p className="text-xs font-medium text-blue-700">Step {selectedIndex + 1} of {stages.length}</p><h3 className="mt-1 text-xl font-semibold text-slate-950">{snippet.title}</h3><p className="mt-1 font-mono text-xs text-slate-500">{snippet.path}</p></div>
            <button type="button" onClick={copyCode} className="inline-flex items-center gap-2 border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-950">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy code"}</button>
          </header>
          <div className="p-5 sm:p-6">
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{snippet.note}</p>
            <p className="mt-3 text-xs font-medium text-slate-500">Technology: <span className="font-mono font-normal">{snippet.technology}</span></p>
            <div className="mt-5 overflow-hidden bg-slate-950">
              <div className="border-b border-white/10 px-4 py-2.5 text-xs text-slate-400">Python teaching equivalent</div>
              <pre className="max-h-[28rem] overflow-auto p-4 text-[13px] leading-6 text-slate-200"><code><PythonCode code={snippet.code} /></code></pre>
            </div>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 sm:px-6">
            <button type="button" disabled={selectedIndex === 0} onClick={() => setSelectedIndex((current) => current - 1)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 disabled:opacity-30"><ArrowLeft className="size-4" />Previous</button>
            <button type="button" disabled={selectedIndex === stages.length - 1} onClick={() => setSelectedIndex((current) => current + 1)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 disabled:opacity-30">Next component<ArrowRight className="size-4" /></button>
          </footer>
        </article>
      </section>

      <section className="border-t border-slate-200 py-12">
        <p className="text-sm font-medium text-slate-500">Classroom flow</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Suggested walkthrough</h2>
        <ol className="mt-7 grid gap-px border border-slate-200 bg-slate-200 md:grid-cols-2">
          {walkthroughs[architecture].map(([title, detail], index) => <li key={title} className="bg-white p-5"><span className="text-xs tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span><h3 className="mt-3 font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></li>)}
        </ol>
      </section>
    </>
  );
}
