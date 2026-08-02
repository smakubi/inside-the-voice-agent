"use client";

import { Layers3, Radio } from "lucide-react";
import type { ArchitectureMode } from "@/types/pipeline";

interface Props { value: ArchitectureMode; onChange: (value: ArchitectureMode) => void; }

const options = [
  { value: "cascaded" as const, label: "Cascaded", description: "The live demo", icon: Layers3 },
  { value: "realtime" as const, label: "Speech-to-speech", description: "Live WebRTC", icon: Radio },
];

export function ArchitectureToggle({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-slate-900">Architecture</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Voice architecture">
        {options.map((option) => {
          const active = value === option.value;
          const Icon = option.icon;
          return (
            <button key={option.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(option.value)} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="size-4" /></span>
              <span><span className="block text-sm font-semibold text-slate-900">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500">{option.description}</span></span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
