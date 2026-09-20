/** Keep token boundaries out of spoken sentences; cap long unpunctuated spans. */
export class SentenceBuffer {
  private pending = "";
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
      if ((!boundary || boundary > this.maxCharacters) && this.pending.length > this.maxCharacters) {
        const space = this.pending.lastIndexOf(" ", this.maxCharacters);
        boundary = space > 0 ? space : this.maxCharacters;
      }
      if (!boundary && final) boundary = this.pending.length;
      if (!boundary) break;
      const sentence = this.pending.slice(0, boundary).trim();
      if (sentence) result.push(sentence);
      this.pending = this.pending.slice(boundary).trimStart();
    }
    return result;
  }
}
