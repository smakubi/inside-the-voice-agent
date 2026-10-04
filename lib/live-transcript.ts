export interface LiveCaption {
  role: "user" | "assistant";
  content: string;
  startMs: number;
  endMs: number;
}
interface Fragment { text: string; start: number; end: number; }

/** Captions are timed fragments, not completed turns; speakers can overlap. */
export class LiveTranscript {
  private groups: Array<{ role: LiveCaption["role"]; fragments: Fragment[] }> = [];
  push(role: LiveCaption["role"], delta: string, start: number, end: number): LiveCaption[] {
    if (!delta || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return this.snapshot();
    const group = [...this.groups].reverse().find((candidate) => candidate.role === role && candidate.fragments.some((fragment) => start <= fragment.end + 1500 && end >= fragment.start - 1500));
    if (group) group.fragments.push({ text: delta, start, end });
    else this.groups.push({ role, fragments: [{ text: delta, start, end }] });
    return this.snapshot();
  }
  private snapshot(): LiveCaption[] {
    return this.groups.map(({ role, fragments }) => {
      const sorted = [...fragments].sort((a, b) => a.start - b.start);
      return { role, content: sorted.map((fragment) => fragment.text).join(""), startMs: sorted[0].start, endMs: Math.max(...sorted.map((fragment) => fragment.end)) };
    }).sort((a, b) => a.startMs - b.startMs);
  }
}
