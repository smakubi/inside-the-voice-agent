import { describe, expect, it } from "vitest";
import { PcmDecoder } from "@/lib/pcm-decoder";

describe("streamed PCM decoding", () => {
  it("preserves signed little-endian samples split at odd byte boundaries", () => {
    const decoder = new PcmDecoder();
    expect([...decoder.push(new Uint8Array([0, 128, 255]))]).toEqual([-1]);
    expect([...decoder.push(new Uint8Array([127, 0, 0]))]).toEqual([32767 / 32768, 0]);
    expect(() => decoder.finish()).not.toThrow();
  });
  it("reports truncated audio instead of dropping the last byte", () => {
    const decoder = new PcmDecoder();
    decoder.push(new Uint8Array([1]));
    expect(() => decoder.finish()).toThrow("incomplete");
  });
});
