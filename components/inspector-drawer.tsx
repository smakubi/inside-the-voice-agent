"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const tabs = ["Overview", "Inputs and Outputs", "Timing", "Events", "Raw Data"] as const;

export function InspectorDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");
  return (
    <AnimatePresence>
      {open ? <motion.aside aria-label="Run inspector" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }} className="fixed inset-x-3 bottom-3 z-30 max-h-[74vh] overflow-hidden rounded-2xl border border-white/15 bg-[#15161a]/98 shadow-2xl shadow-black/60 backdrop-blur-xl lg:inset-y-4 lg:right-4 lg:left-auto lg:w-[440px]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="text-xs font-semibold tracking-[0.18em] text-sky-300/70 uppercase">Inspector</p><h2 className="mt-1 text-lg font-semibold">Inside this run</h2></div><button type="button" onClick={onClose} aria-label="Close inspector" className="grid size-9 place-items-center rounded-lg border border-white/10 text-zinc-400 hover:text-white"><X className="size-4" /></button></div>
        <div className="overflow-x-auto border-b border-white/10 px-3" role="tablist" aria-label="Inspector sections">{tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab ? "border-sky-300 text-sky-200" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{tab}</button>)}</div>
        <div className="overflow-y-auto p-5" role="tabpanel"><div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-white/10 bg-black/15 p-8 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.035] font-mono text-sm text-zinc-500">00</span><h3 className="mt-4 font-semibold text-zinc-200">No run data yet</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">Start a demo in a later milestone to inspect stage inputs, outputs, timing, and events. This panel currently contains placeholder content only.</p><p className="mt-4 text-xs font-medium text-amber-200/80">Viewing: {activeTab}</p></div></div></div>
      </motion.aside> : null}
    </AnimatePresence>
  );
}
