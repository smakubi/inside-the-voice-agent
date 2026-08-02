import { ArrowDown, ArrowRight } from "lucide-react";

export function PipelineConnector() {
  return <div className="flex h-8 shrink-0 items-center justify-center text-slate-300 lg:h-auto lg:w-8" aria-hidden="true"><ArrowDown className="size-4 lg:hidden" /><ArrowRight className="hidden size-4 lg:block" /></div>;
}
