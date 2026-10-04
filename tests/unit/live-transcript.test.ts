import { describe, expect, it } from "vitest";
import { LiveTranscript } from "@/lib/live-transcript";

describe("full-duplex captions", () => {
  it("continues each speaker's caption independently during overlap", () => {
    const transcript = new LiveTranscript();
    transcript.push("user", "I'd like", 1000, 1200);
    transcript.push("assistant", "Sure.", 1100, 1300);
    expect(transcript.push("user", " to change my booking", 1200, 1600)).toEqual([
      { role: "user", content: "I'd like to change my booking", startMs: 1000, endMs: 1600 },
      { role: "assistant", content: "Sure.", startMs: 1100, endMs: 1300 },
    ]);
  });
  it("orders late fragments by session timestamps and starts a new caption after a gap", () => {
    const transcript = new LiveTranscript();
    transcript.push("user", "Hello", 1000, 1200);
    transcript.push("user", " again", 1400, 1600);
    transcript.push("user", " there", 1200, 1400);
    expect(transcript.push("user", "Next topic", 4000, 4400)).toEqual([
      { role: "user", content: "Hello there again", startMs: 1000, endMs: 1600 },
      { role: "user", content: "Next topic", startMs: 4000, endMs: 4400 },
    ]);
  });
});
