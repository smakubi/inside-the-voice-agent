import { NextResponse } from "next/server";
import { voiceDefaults, voiceModels } from "@/config/models";
import { getOpenAI } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Please record some audio first." }, { status: 400 });
    }

    if (audio.size > voiceDefaults.maxAudioBytes) {
      return NextResponse.json({ error: "Recording is too large. Keep it under 30 seconds." }, { status: 413 });
    }

    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audio,
      model: voiceModels.transcription,
    });

    return NextResponse.json({ text: transcription.text.trim() });
  } catch (error) {
    console.error("Transcription failed", error);
    return NextResponse.json(
      { error: "I couldn't transcribe that recording. Check the API key and try again." },
      { status: 502 },
    );
  }
}
