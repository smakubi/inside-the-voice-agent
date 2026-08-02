import { BookOpenText, Lightbulb } from "lucide-react";
import type { Scenario } from "@/types/pipeline";

interface Props { scenarios: Scenario[]; selectedId: string; onChange: (id: string) => void; }

export function ScenarioSelector({ scenarios, selectedId, onChange }: Props) {
  const selected = scenarios.find((scenario) => scenario.id === selectedId);
  return (
    <section aria-labelledby="scenario-heading">
      <div className="mb-3 flex items-center justify-between"><h2 id="scenario-heading" className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">Scenario</h2><span className="text-xs text-zinc-600">Teaching context</span></div>
      <label className="sr-only" htmlFor="scenario-select">Choose a demonstration scenario</label>
      <div className="relative"><select id="scenario-select" value={selectedId} onChange={(event) => onChange(event.target.value)} className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-4 pr-10 text-sm font-medium text-zinc-100 transition-colors hover:border-white/20"><option value="">Choose a scenario</option>{scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select><BookOpenText className="pointer-events-none absolute top-3.5 right-3.5 size-4 text-zinc-500" aria-hidden="true" /></div>
      <div className="mt-4 min-h-40 rounded-xl border border-white/8 bg-white/[0.025] p-4" aria-live="polite">
        {selected ? <><p className="text-sm leading-6 text-zinc-300">{selected.description}</p><div className="mt-4 flex gap-3 border-t border-white/8 pt-4"><Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" /><div><p className="text-xs font-semibold text-amber-200">Try asking</p><p className="mt-1 text-sm leading-5 text-zinc-400">“{selected.suggestedPrompt}”</p></div></div></> : <p className="text-sm leading-6 text-zinc-500">Choose a scenario to reveal its teaching prompt and discussion focus.</p>}
      </div>
    </section>
  );
}
