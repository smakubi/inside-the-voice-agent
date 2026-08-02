import { MessageCircleQuestion } from "lucide-react";

export function TeachingNote() {
  return <aside className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-transparent p-5"><MessageCircleQuestion className="size-5 text-sky-300" aria-hidden="true" /><p className="mt-5 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">Ask the class</p><p className="mt-2 text-lg font-medium leading-7 text-zinc-100">What changed when the three middle stages became one?</p></aside>;
}
