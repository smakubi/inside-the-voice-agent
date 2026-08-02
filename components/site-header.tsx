import Link from "next/link";
import { AudioWaveform } from "lucide-react";

interface Props {
  showStatus?: boolean;
}

export function SiteHeader({ showStatus = false }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 py-2">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white">
          <AudioWaveform className="size-5" aria-hidden="true" />
        </span>
        <span className="font-semibold tracking-[-0.02em] text-slate-950">Inside the Voice Agent</span>
      </Link>
      <div className="flex items-center gap-4">
        <nav aria-label="Primary" className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600">
          <Link href="/" className="rounded-lg px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-950">Demo</Link>
          <Link href="/providers" className="rounded-lg px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-950">Providers</Link>
        </nav>
        {showStatus ? <span className="hidden items-center gap-2 text-sm text-slate-500 lg:flex"><span className="size-2 rounded-full bg-emerald-500" />Voice service ready</span> : null}
      </div>
    </header>
  );
}
