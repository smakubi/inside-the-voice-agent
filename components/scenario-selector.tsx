import { ChevronDown } from "lucide-react";
import type { Scenario } from "@/types/pipeline";

interface Props { scenarios: Scenario[]; selectedId: string; onChange: (id: string) => void; }

export function ScenarioSelector({ scenarios, selectedId, onChange }: Props) {
  return (
    <div>
      <label className="mb-3 block text-sm font-semibold text-slate-900" htmlFor="scenario-select">Conversation context</label>
      <div className="relative">
        <select id="scenario-select" value={selectedId} onChange={(event) => onChange(event.target.value)} className="h-16 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm font-medium text-slate-900 transition hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
          {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name} — {scenario.suggestedPrompt}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-6 size-4 text-slate-400" aria-hidden="true" />
      </div>
    </div>
  );
}
