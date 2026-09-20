// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({ text: vi.fn(), speech: vi.fn() }));
vi.mock("ai", () => ({ streamText: providers.text, generateText: vi.fn(async () => ({ text: "Buffered answer" })) }));
vi.mock("@/lib/baseten", () => ({ getBaseten: () => ({ chat: () => "test-model" }) }));
vi.mock("@/lib/openai", () => ({ getOpenAI: () => ({ audio: { speech: { create: providers.speech } } }) }));
import { POST as respond } from "@/app/api/respond/route";
import { POST as speak } from "@/app/api/speak/route";
import { readTextStream } from "@/lib/text-stream";

afterEach(() => vi.clearAllMocks());

describe("streaming routes", () => {
  it("streams model deltas and forwards cancellation to the provider", async () => {
    const controller = new AbortController();
    providers.text.mockReturnValue({ fullStream: (async function* () { yield { type: "text-delta", text: "Hello. " }; yield { type: "text-delta", text: "Next." }; yield { type: "finish", finishReason: "stop" }; })() });
    const response = await respond(new Request("http://localhost/api/respond", {
      method: "POST", body: JSON.stringify({ text: "hello" }), signal: controller.signal,
    }));
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const parts = [];
    for await (const text of readTextStream(response)) parts.push(text);
    expect(parts).toEqual(["Hello. ", "Next."]);
    const options = providers.text.mock.calls[0][0];
    expect(options.maxOutputTokens).toBe(220);
    controller.abort();
    expect(options.abortSignal.aborted).toBe(true);
  });

  it("reports a provider error after partial text instead of completing the answer", async () => {
    providers.text.mockReturnValue({ fullStream: (async function* () {
      yield { type: "text-delta", text: "Partial" };
      yield { type: "error", error: new Error("Private provider detail") };
    })() });
    const response = await respond(new Request("http://localhost/api/respond", { method: "POST", body: JSON.stringify({ text: "hello" }) }));
    const parts: string[] = [];
    await expect((async () => {
      for await (const text of readTextStream(response)) parts.push(text);
    })()).rejects.toThrow("interrupted");
    expect(parts).toEqual(["Partial"]);
  });

  it("rejects an incomplete provider stream even if the SDK emits an ambiguous finish", async () => {
    providers.text.mockReturnValue({ fullStream: (async function* () {
      yield { type: "text-delta", text: "Partial" };
      yield { type: "finish", finishReason: "other" };
    })() });
    const response = await respond(new Request("http://localhost/api/respond", { method: "POST", body: JSON.stringify({ text: "hello" }) }));
    await expect((async () => {
      for await (const text of readTextStream(response)) void text;
    })()).rejects.toThrow("interrupted");
  });

  it("returns PCM bytes while the upstream audio stream is still open", async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const upstream = new Response(new ReadableStream<Uint8Array>({ start(c) { source = c; c.enqueue(new Uint8Array([0, 1])); } }));
    providers.speech.mockResolvedValue(upstream);
    const request = new Request("http://localhost/api/speak", { method: "POST", body: JSON.stringify({ text: "hello" }) });
    const pending = speak(request);
    const response = await Promise.race([pending, new Promise<null>((resolve) => setTimeout(() => resolve(null), 150))]);
    // Unblock the old buffered implementation as well, keeping a failing test clean.
    if (!response) { source.close(); await pending; }
    expect(response, "The route must not buffer the complete audio").not.toBeNull();
    expect(response!.headers.get("content-type")).toBe("audio/pcm");
    const reader = response!.body!.getReader();
    expect((await reader.read()).value).toEqual(new Uint8Array([0, 1]));
    source.close();
    expect((await reader.read()).done).toBe(true);
    expect(providers.speech.mock.calls[0][0].response_format).toBe("pcm");
    expect(providers.speech.mock.calls[0][1].signal).toBe(request.signal);
  });
});
