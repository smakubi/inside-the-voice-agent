import { ArrowDown, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export function PipelineConnector() {
  return <div className="relative flex h-9 shrink-0 items-center justify-center lg:h-auto lg:w-9" aria-hidden="true"><div className="absolute h-full w-px bg-white/10 lg:h-px lg:w-full" /><motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.22 }} className="relative grid size-7 place-items-center rounded-full border border-white/10 bg-[#111216] text-zinc-500"><ArrowDown className="size-3.5 lg:hidden" /><ArrowRight className="hidden size-3.5 lg:block" /></motion.span></div>;
}
