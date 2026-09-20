import { NextResponse } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { voiceModels } from "@/config/models";
import { getBaseten } from "@/lib/baseten";
import { createTextStreamResponse } from "@/lib/text-stream";

export const maxDuration = 60;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});

const requestSchema = z.object({
  text: z.string().trim().min(1).max(4_000),
  history: z.array(messageSchema).max(12).default([]),
  safetyIdentifier: z.string().min(8).max(128).optional(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const baseten = getBaseten();
    return createTextStreamResponse(async function* (signal) {
      const result = streamText({
        model: baseten.chat(voiceModels.response),
        instructions: [
          "You are a practical voice assistant in a live spoken conversation.",
          "Answer directly in one to three short sentences unless the user asks for detail.",
          "Use natural spoken language. Do not use markdown, headings, or lists.",
        ].join("\n"),
        messages: [
          ...body.history,
          { role: "user" as const, content: body.text },
        ],
        temperature: 0.3,
        maxOutputTokens: 220,
        abortSignal: signal,
      });
      // AI SDK's textStream filters out error events. Consume the full stream so a
      // provider failure after partial text cannot masquerade as a complete answer.
      let completed = false;
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") yield part.text;
        if (part.type === "error") throw part.error;
        if (part.type === "abort") throw new Error("Response generation was aborted");
        if (part.type === "finish") completed = part.finishReason === "stop" || part.finishReason === "length";
      }
      if (!completed) throw new Error("Response generation ended without a valid completion");
    }, request.signal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "That message could not be processed." }, { status: 400 });
    }

    console.error("Response generation failed", error);
    return NextResponse.json(
      { error: "The language model didn't return an answer. Please try again." },
      { status: 502 },
    );
  }
}
