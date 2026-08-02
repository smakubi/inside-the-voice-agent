import { NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { voiceModels } from "@/config/models";
import { getBaseten } from "@/lib/baseten";
import { generateNonEmptyResponse } from "@/lib/non-empty-response";

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
    const answer = await generateNonEmptyResponse(async () => {
      const { text } = await generateText({
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
      });
      return text;
    });

    return NextResponse.json({ text: answer });
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
