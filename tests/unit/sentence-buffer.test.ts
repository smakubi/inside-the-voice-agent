import { describe, expect, it } from "vitest";
import { SentenceBuffer } from "@/lib/sentence-buffer";

describe("SentenceBuffer", () => {
  it("emits a complete sentence while keeping the unfinished next sentence", () => {
    const buffer = new SentenceBuffer();
    expect(buffer.push("Hello there.")).toEqual([]);
    expect(buffer.push(" How can")).toEqual(["Hello there."]);
    expect(buffer.push(" I help? ")).toEqual(["How can I help?"]);
    expect(buffer.flush()).toEqual([]);
  });

  it("keeps decimals and common abbreviations intact across token boundaries", () => {
    const buffer = new SentenceBuffer();
    expect(buffer.push("Dr. Lee paid 3.")).toEqual([]);
    expect(buffer.push('14 dollars. "Thanks!" Next')).toEqual([
      "Dr. Lee paid 3.14 dollars.", '"Thanks!"',
    ]);
    expect(buffer.flush()).toEqual(["Next"]);
  });

  it("bounds unpunctuated speech chunks without losing words", () => {
    const buffer = new SentenceBuffer(60);
    const text = "This answer keeps going without punctuation and should start speaking before the model finishes its long explanation";
    const chunks = buffer.push(text);
    expect(chunks.length).toBeGreaterThan(0);
    const all = [...chunks, ...buffer.flush()];
    expect(all.join(" ")).toBe(text);
    expect(all.every((chunk) => chunk.length <= 60)).toBe(true);
  });
});
