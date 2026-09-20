// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runStreamedVoice } from "@/lib/streamed-voice";
import { createTextStreamResponse } from "@/lib/text-stream";

describe("streamed voice orchestration", () => {
  it("cancels a blocked PCM read and stops already queued audio", async () => {
    const controller = new AbortController();
    let audioStarted!: () => void;
    const ready = new Promise<void>((resolve) => { audioStarted = resolve; });
    let canceled = false;
    let stopped = false;
    const result = runStreamedVoice({
      response: createTextStreamResponse(async function* () { yield "Hello there."; }, controller.signal),
      signal: controller.signal, onText() {},
      player: { async enqueue() { audioStarted(); }, async finishSentence() {}, async drain() {}, stop() { stopped = true; } },
      async synthesize() { return new Response(new ReadableStream({
        start(c) { c.enqueue(new Uint8Array([0, 1])); },
        cancel() { canceled = true; },
      })); },
    });
    const assertion = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await ready;
    controller.abort();
    await assertion;
    expect(canceled).toBe(true);
    expect(stopped).toBe(true);
  });

  it("stops playback when the audio network stream fails after the first bytes", async () => {
    const signal = new AbortController().signal;
    let stopped = false;
    let source!: ReadableStreamDefaultController<Uint8Array>;
    await expect(runStreamedVoice({
      response: createTextStreamResponse(async function* () { yield "Hello there."; }, signal),
      signal, onText() {},
      player: { async enqueue() { source.error(new Error("Audio connection lost")); }, async finishSentence() {}, async drain() {}, stop() { stopped = true; } },
      async synthesize() { return new Response(new ReadableStream({
        start(c) { source = c; c.enqueue(new Uint8Array([0, 1])); },
      })); },
    })).rejects.toThrow("Audio connection lost");
    expect(stopped).toBe(true);
  });

  it("plays the first sentence before the LLM and TTS finish, and preserves sentence order", async () => {
    let releaseText!: () => void;
    let releaseAudio!: () => void;
    let firstAudio!: () => void;
    const textGate = new Promise<void>((resolve) => { releaseText = resolve; });
    const audioGate = new Promise<void>((resolve) => { releaseAudio = resolve; });
    const played = new Promise<void>((resolve) => { firstAudio = resolve; });
    const signal = new AbortController().signal;
    const response = createTextStreamResponse(async function* () {
      yield "First sentence. ";
      await textGate;
      yield "Second sentence.";
    }, signal);
    const spoken: string[] = [];
    const samples: number[] = [];
    let drained = false;
    const result = runStreamedVoice({ response, signal, onText() {},
      player: {
        async enqueue(bytes) { samples.push(...bytes); firstAudio(); },
        async finishSentence() {},
        async drain() { drained = true; },
        stop() {},
      },
      async synthesize(text) {
        spoken.push(text);
        return new Response(new ReadableStream({ async start(c) {
          c.enqueue(new Uint8Array([1, 0]));
          if (spoken.length === 1) await audioGate;
          c.enqueue(new Uint8Array([2, 0]));
          c.close();
        } }));
      },
    });
    await played;
    expect(spoken).toEqual(["First sentence."]);
    expect(samples).toEqual([1, 0]);
    expect(drained).toBe(false);
    releaseText();
    releaseAudio();
    expect(await result).toBe("First sentence. Second sentence.");
    expect(spoken).toEqual(["First sentence.", "Second sentence."]);
    expect(samples).toEqual([1, 0, 2, 0, 1, 0, 2, 0]);
    expect(drained).toBe(true);
  });

  it("cancels pending synthesis and never speaks queued sentences after stopping", async () => {
    const controller = new AbortController();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const spoken: string[] = [];
    let stopped = false;
    const result = runStreamedVoice({
      response: createTextStreamResponse(async function* () { yield "One sentence. Another sentence."; }, controller.signal),
      signal: controller.signal, onText() {},
      player: { async enqueue() {}, async finishSentence() {}, async drain() {}, stop() { stopped = true; } },
      async synthesize(text, signal) {
        spoken.push(text);
        started();
        return await new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
      },
    });
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await ready;
    controller.abort();
    await rejected;
    expect(spoken).toEqual(["One sentence."]);
    expect(stopped).toBe(true);
  });

  it("reports a speech failure without leaving queued playback running", async () => {
    let stopped = false;
    const signal = new AbortController().signal;
    await expect(runStreamedVoice({
      response: createTextStreamResponse(async function* () { yield "Hello there."; }, signal),
      signal, onText() {},
      player: { async enqueue() {}, async finishSentence() {}, async drain() {}, stop() { stopped = true; } },
      async synthesize() { return Response.json({ error: "Speech service failed" }, { status: 502 }); },
    })).rejects.toThrow("Speech service failed");
    expect(stopped).toBe(true);
  });

  it("unblocks an unfinished text stream when speech fails", async () => {
    const signal = new AbortController().signal;
    await expect(runStreamedVoice({
      response: createTextStreamResponse(async function* (upstream) {
        yield "First sentence. ";
        await new Promise<void>((resolve) => upstream.addEventListener("abort", () => resolve(), { once: true }));
      }, signal),
      signal, onText() {},
      player: { async enqueue() {}, async finishSentence() {}, async drain() {}, stop() {} },
      async synthesize() { throw new Error("Provider unavailable"); },
    })).rejects.toThrow("Provider unavailable");
  });
});
