// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTextStreamResponse, readTextStream } from "@/lib/text-stream";

describe("text streaming protocol", () => {
  it("delivers the first delta before generation finishes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const response = createTextStreamResponse(async function* () {
      yield "First sentence. ";
      await gate;
      yield "Second sentence.";
    }, new AbortController().signal);
    const iterator = readTextStream(response)[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: "First sentence. ", done: false });
    release();
    expect(await iterator.next()).toEqual({ value: "Second sentence.", done: false });
    expect((await iterator.next()).done).toBe(true);
  });

  it("retries only an empty answer, never a partially spoken failed answer", async () => {
    let attempts = 0;
    const response = createTextStreamResponse(async function* () {
      if (++attempts === 1) { yield "  "; return; }
      yield "Answer";
      throw new Error("private provider details");
    }, new AbortController().signal);
    const parts: string[] = [];
    await expect((async () => {
      for await (const text of readTextStream(response)) parts.push(text);
    })()).rejects.toThrow("The answer stream was interrupted");
    expect(parts).toEqual(["Answer"]);
    expect(attempts).toBe(2);
  });

  it("rejects a truncated stream without a completion event", async () => {
    const response = new Response('{"type":"text","text":"Partial"}\n');
    await expect((async () => {
      for await (const text of readTextStream(response)) void text;
    })()).rejects.toThrow("interrupted");
  });

  it("decodes UTF-8 and protocol lines split across network chunks", async () => {
    const bytes = new TextEncoder().encode('{"type":"text","text":"café 🎉"}\n{"type":"done"}\n');
    const response = new Response(new ReadableStream({ start(c) {
      for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
      c.close();
    } }));
    const parts = [];
    for await (const part of readTextStream(response)) parts.push(part);
    expect(parts).toEqual(["café 🎉"]);
  });

  it("cancels the upstream generator when the client disconnects", async () => {
    let upstreamSignal!: AbortSignal;
    const response = createTextStreamResponse(async function* (signal) {
      upstreamSignal = signal;
      yield "Hello";
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    }, new AbortController().signal);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(upstreamSignal.aborted).toBe(true);
  });
});
