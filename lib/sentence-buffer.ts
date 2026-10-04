/** Keep token boundaries out of spoken sentences; cap long unpunctuated spans. */
export class SentenceBuffer {
  private pending = "";
  private emitted = false;
  constructor(private readonly maxCharacters = 240) {}

  push(delta: string): string[] {
    this.pending += delta;
    return this.take(false);
  }

  flush(): string[] { return this.take(true); }

  private take(final: boolean): string[] {
    const result: string[] = [];
    this.pending = this.pending.trimStart();
    while (this.pending) {
      let boundary = 0;
      for (const match of this.pending.matchAll(/[.!?。！？]+["'”’)]*(?=\s|$)/g)) {
        const end = match.index! + match[0].length;
        // A trailing period may still be followed by a decimal digit next token.
        if (!final && end === this.pending.length) break;
        const prefix = this.pending.slice(0, end);
        if (/(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)|\b[A-Z]|\b(?:[A-Za-z]\.)+[A-Za-z])\.$/i.test(prefix)) continue;
        boundary = end;
        break;
      }
      // Only the opening phrase is eager; later sentences keep their prosody.
      if (!boundary && !this.emitted) {
        const clause = /[,;:]\s/.exec(this.pending);
        if (clause && clause.index >= 24) boundary = clause.index + 1;
        else if (this.pending.length > 100) {
          const space = this.pending.lastIndexOf(" ", 100);
          if (space > 0) boundary = space;
        }
      }
      if ((!boundary || boundary > this.maxCharacters) && this.pending.length > this.maxCharacters) {
        const space = this.pending.lastIndexOf(" ", this.maxCharacters);
        boundary = space > 0 ? space : this.maxCharacters;
      }
      if (!boundary && final) boundary = this.pending.length;
      if (!boundary) break;
      const sentence = this.pending.slice(0, boundary).trim();
      if (sentence) { result.push(sentence); this.emitted = true; }
      this.pending = this.pending.slice(boundary).trimStart();
    }
    return result;
  }
}
