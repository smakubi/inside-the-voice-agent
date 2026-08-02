import { NextResponse } from "next/server";
import { voiceModels } from "@/config/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Voice service is not configured." }, { status: 503 });

  const sdp = await request.text();
  if (!sdp || sdp.length > 100_000) {
    return NextResponse.json({ error: "Invalid WebRTC offer." }, { status: 400 });
  }

  const session = {
    type: "realtime",
    model: voiceModels.realtime,
    instructions: "You are a warm, practical voice assistant. Reply naturally and concisely.",
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: { type: "semantic_vad" },
      },
      output: { voice: "marin" },
    },
  };
  const formData = new FormData();
  formData.set("sdp", sdp);
  formData.set("session", JSON.stringify(session));

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    const answer = await response.text();

    if (!response.ok) {
      console.error("Realtime session failed", response.status, answer);
      return NextResponse.json({ error: "The realtime session could not be started." }, { status: 502 });
    }

    return new NextResponse(answer, { headers: { "Content-Type": "application/sdp" } });
  } catch (error) {
    console.error("Realtime session failed", error);
    return NextResponse.json({ error: "The realtime session could not be started." }, { status: 502 });
  }
}
