"use client";

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import type { CodeSnippet } from "@/config/code-snippets";

export function CodeInspector({ snippet, onClose }: { snippet?: CodeSnippet; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!snippet) return null;

  async function copyCode() {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 max-h-[82vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[520px]" aria-label="Python code inspector">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Python example</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{snippet.title}</h2><p className="mt-1 font-mono text-xs text-slate-500">{snippet.technology}</p></div>
        <button type="button" onClick={onClose} aria-label="Close code inspector" className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"><X className="size-4" /></button>
      </div>
      <div className="max-h-[calc(82vh-105px)] overflow-y-auto p-5">
        <p className="text-sm leading-6 text-slate-600">{snippet.note}</p>
        <div className="mt-4 overflow-hidden rounded-xl bg-slate-950">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5"><span className="text-xs font-medium text-slate-400">python</span><button type="button" onClick={copyCode} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}</button></div>
          <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-slate-200"><code>{snippet.code}</code></pre>
        </div>
      </div>
    </aside>
  );
}
