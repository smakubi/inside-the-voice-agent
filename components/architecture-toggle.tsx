"use client";

import { Layers3, Radio } from "lucide-react";
import { motion } from "motion/react";
import type { ArchitectureMode } from "@/types/pipeline";

interface Props { value: ArchitectureMode; onChange: (value: ArchitectureMode) => void; }

const options = [
  { value: "cascaded" as const, label: "Cascaded", icon: Layers3 },
  { value: "realtime" as const, label: "Speech-to-Speech", icon: Radio },
];

export function ArchitectureToggle({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">Architecture</legend>
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/30 p-1" role="radiogroup" aria-label="Voice architecture">
        {options.map((option) => {
          const active = value === option.value;
          const Icon = option.icon;
          return (
            <button key={option.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(option.value)} className="relative flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors">
              {active ? <motion.span layoutId="architecture-active" className="absolute inset-0 rounded-lg border border-sky-400/30 bg-sky-400/12" transition={{ type: "spring", bounce: 0.12, duration: 0.42 }} /> : null}
              <Icon className={`relative size-4 ${active ? "text-sky-300" : "text-zinc-500"}`} aria-hidden="true" />
              <span className={`relative ${active ? "text-white" : "text-zinc-400"}`}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
