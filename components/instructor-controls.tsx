import { Braces, Play, RotateCcw, ScanSearch } from "lucide-react";

interface Props {
  lectureMode: boolean; inspectorOpen: boolean; developerMode: boolean;
  onLectureModeChange: () => void; onInspectorChange: () => void; onDeveloperModeChange: () => void;
  onStart: () => void; onReset: () => void;
}

interface ToggleProps { label: string; pressed: boolean; icon: typeof ScanSearch; onClick: () => void; }

function ToggleButton({ label, pressed, icon: Icon, onClick }: ToggleProps) {
  return <button type="button" role="switch" aria-checked={pressed} onClick={onClick} className={`flex min-h-11 items-center justify-between gap-4 rounded-xl border px-4 text-sm font-medium transition-colors ${pressed ? "border-sky-400/30 bg-sky-400/10 text-sky-100" : "border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-zinc-200"}`}><span className="flex items-center gap-2.5"><Icon className="size-4" aria-hidden="true" />{label}</span><span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${pressed ? "bg-sky-400" : "bg-zinc-700"}`} aria-hidden="true"><span className={`block size-4 rounded-full bg-white transition-transform ${pressed ? "translate-x-4" : "translate-x-0"}`} /></span></button>;
}

export function InstructorControls(props: Props) {
  return (
    <section aria-labelledby="controls-heading" className="rounded-2xl border border-white/10 bg-[#111216]/92 p-5">
      <div className="flex items-center justify-between"><div><p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">Teaching tools</p><h2 id="controls-heading" className="mt-1 text-lg font-semibold">Instructor controls</h2></div><span className="rounded-full border border-amber-300/20 bg-amber-300/8 px-2.5 py-1 text-[11px] font-semibold text-amber-200">Static preview</span></div>
      <div className="mt-5 grid gap-2"><ToggleButton label="Lecture Mode" pressed={props.lectureMode} icon={Play} onClick={props.onLectureModeChange} /><ToggleButton label="Inspector" pressed={props.inspectorOpen} icon={ScanSearch} onClick={props.onInspectorChange} /><ToggleButton label="Developer Mode" pressed={props.developerMode} icon={Braces} onClick={props.onDeveloperModeChange} /></div>
      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2"><button type="button" onClick={props.onStart} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white"><Play className="size-4 fill-current" aria-hidden="true" />Start Demo</button><button type="button" onClick={props.onReset} className="grid min-h-12 min-w-12 place-items-center rounded-xl border border-white/10 text-zinc-400 transition-colors hover:border-white/20 hover:text-white" aria-label="Reset teaching interface"><RotateCcw className="size-4" aria-hidden="true" /></button></div>
    </section>
  );
}
