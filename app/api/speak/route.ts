import { NextResponse } from "next/server";
import { z } from "zod";
import { voiceDefaults, voiceModels } from "@/config/models";
import { getOpenAI } from "@/lib/openai";

export const maxDuration = 60;

const requestSchema = z.object({
  text: z.string().trim().min(1).max(4_000),
});

export async function POST(request: Request) {
  try {
    const { text } = requestSchema.parse(await request.json());
    const audio = await getOpenAI().audio.speech.create({
      model: voiceModels.speech,
      voice: voiceDefaults.voice,
      input: text,
      instructions: "Speak naturally, warmly, and clearly at a conversational pace.",
      response_format: "pcm",
    }, { signal: request.signal });

    if (!audio.body) throw new Error("Speech provider returned no audio stream");

    return new NextResponse(audio.body, {
      headers: {
        "Cache-Control": "no-store, no-transform",
        "Content-Type": "audio/pcm",
        "X-Audio-Sample-Rate": "24000",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "That response could not be spoken." }, { status: 400 });
    }

    console.error("Speech generation failed", error);
    return NextResponse.json(
      { error: "I couldn't generate audio. You can still read the response below." },
      { status: 502 },
    );
  }
}
