// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as transcription } from "@/app/api/transcription/session/route";
import { POST as live } from "@/app/api/live/session/route";
import { POST as realtime } from "@/app/api/realtime/session/route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const offer = () => new Request("http://localhost/api/session", { method: "POST", body: "v=0\r\ntest-offer" });

describe("voice session adapters", () => {
  it("opens transcription without generating an assistant response or waiting for a recorded file", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let session = {} as { type: string; model?: string; audio: { input: { transcription: { model: string }; turn_detection: unknown } } };
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      session = JSON.parse(String((init.body as FormData).get("session")));
      return new Response("answer-sdp");
    });
    expect(await (await transcription(offer())).text()).toBe("answer-sdp");
    expect(session.type).toBe("transcription");
    expect(session.audio.input.transcription.model).toBe("gpt-live-transcribe");
    expect(session.audio.input.turn_detection).toBeNull();
    expect(session.model).toBeUndefined();
  });

  it("uses the Live session API and preserves its transport response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let payload = {} as { session: { model: string; audio?: { format?: string }; delegation: { responses: { tools: unknown[] } } }; transport: { type: string; sdp: string } };
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.openai.com/v1/live/sessions");
      payload = JSON.parse(String(init.body));
      return Response.json({ session: { id: "live_test" }, transport: { type: "webrtc", sdp: "answer" } });
    });
    const response = await live(offer());
    expect(await response.json()).toEqual({ session: { id: "live_test" }, transport: { type: "webrtc", sdp: "answer" } });
    expect(payload.session.model).toBe("gpt-live-1");
    expect(payload.transport).toEqual({ type: "webrtc", sdp: "v=0\r\ntest-offer" });
    expect(payload.session.delegation.responses.tools).toEqual([{ type: "web_search" }]);
    expect(payload.session.audio?.format).toBeUndefined();
  });

  it("requests eager native turn detection while retaining interruption handling", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let detection: Record<string, unknown> = {};
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      detection = JSON.parse(String((init.body as FormData).get("session"))).audio.input.turn_detection;
      return new Response("answer-sdp");
    });
    await realtime(offer());
    expect(detection).toEqual({ type: "semantic_vad", eagerness: "high", create_response: true, interrupt_response: true });
  });

  it.each([transcription, live])("rejects invalid offers and hides provider credentials and errors", async (route) => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetch = vi.fn(async () => new Response("private provider detail test-key", { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    const invalid = await route(new Request("http://localhost/api/session", { method: "POST", body: "" }));
    expect(invalid.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    const failed = await route(offer());
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("test-key");
  });
});
