// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getBaseten } from "@/lib/baseten";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("sends Baseten's non-thinking template option on the actual GLM request", async () => {
  vi.stubEnv("BASETEN_API_KEY", "test");
  let body: Record<string, unknown> = {};
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return new Response('data: {"id":"test","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\ndata: {"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } });
  });
  const result = await getBaseten().chat("zai-org/GLM-4.7").doStream({ prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }] });
  const reader = result.stream.getReader();
  while (!(await reader.read()).done) {}
  expect(body.chat_template_args).toEqual({ enable_thinking: false });
  expect(body.stream).toBe(true);
});
