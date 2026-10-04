import { NextResponse } from "next/server";
import { voiceModels } from "@/config/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Voice service is not configured." }, { status: 503 });
  const sdp = await request.text();
  if (!sdp.trim() || sdp.length > 100_000) return NextResponse.json({ error: "Invalid WebRTC offer." }, { status: 400 });
  try {
    const response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      body: JSON.stringify({
        session: {
          model: voiceModels.live,
          instructions: "You are a concise, helpful voice assistant. Listen while speaking and adapt to corrections. Answer simple questions directly. Delegate complex reasoning and requests needing current information to the backend. Avoid filler and unnecessary preambles.",
          audio: { output: { voice: "marin" } },
          delegation: { type: "responses", responses: {
            model: voiceModels.liveBackend,
            instructions: "Return concise, grounded results for a spoken conversation. Use web search for current facts. Do not invent information.",
            tools: [{ type: "web_search" }], tool_choice: "auto",
            reasoning: { effort: "low" }, max_output_tokens: 500,
          } },
        },
        transport: { type: "webrtc", sdp },
      }),
    });
    if (!response.ok) {
      console.error("GPT-Live session failed", response.status);
      return NextResponse.json({ error: "GPT-Live is unavailable. This OpenAI project needs access to gpt-live-1 and its backend model." }, { status: 502 });
    }
    const result = await response.json();
    if (!result.session?.id || !result.transport?.sdp) throw new Error("Invalid Live session response");
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The GPT-Live connection could not be started." }, { status: 502 });
  }
}
