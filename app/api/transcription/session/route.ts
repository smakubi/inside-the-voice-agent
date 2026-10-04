import { NextResponse } from "next/server";
import { voiceModels } from "@/config/models";

export const runtime = "nodejs";

/** A persistent, transcription-only connection; GLM and TTS remain separate. */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Voice service is not configured." }, { status: 503 });
  const sdp = await request.text();
  if (!sdp.trim() || sdp.length > 100_000) return NextResponse.json({ error: "Invalid WebRTC offer." }, { status: 400 });
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify({
    type: "transcription",
    audio: { input: {
      transcription: { model: voiceModels.liveTranscription, delay: "low" },
      // gpt-live-transcribe needs client-side VAD and explicit commits.
      turn_detection: null,
      noise_reduction: { type: "near_field" },
    } },
  }));
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
    });
    if (!response.ok) {
      console.error("Transcription session failed", response.status);
      return NextResponse.json({ error: "Live transcription is unavailable. Check model access for this OpenAI project." }, { status: 502 });
    }
    return new NextResponse(await response.text(), { headers: { "Content-Type": "application/sdp" } });
  } catch {
    return NextResponse.json({ error: "The transcription connection could not be started." }, { status: 502 });
  }
}
