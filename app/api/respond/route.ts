import { NextResponse } from "next/server";
import { z } from "zod";
import { voiceModels } from "@/config/models";
import { scenarios } from "@/config/scenarios";
import { getOpenAI } from "@/lib/openai";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});

const requestSchema = z.object({
  text: z.string().trim().min(1).max(4_000),
  scenarioId: z.string().max(80).default("general-conversation"),
  history: z.array(messageSchema).max(12).default([]),
  safetyIdentifier: z.string().min(8).max(128).optional(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const scenario = scenarios.find((item) => item.id === body.scenarioId) ?? scenarios[0];
    const response = await getOpenAI().responses.create({
      model: voiceModels.response,
      reasoning: { effort: "none" },
      instructions: [
        "You are a warm, practical voice assistant in a live spoken conversation.",
        `Current context: ${scenario.description}`,
        "Answer directly in one to three short sentences unless the user asks for detail.",
        "Use natural spoken language. Do not use markdown, headings, or lists.",
      ].join("\n"),
      input: [
        ...body.history,
        { role: "user" as const, content: body.text },
      ],
      max_output_tokens: 220,
      safety_identifier: body.safetyIdentifier,
    });

    const text = response.output_text.trim();
    if (!text) {
      throw new Error("The model returned an empty response");
    }

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "That message could not be processed." }, { status: 400 });
    }

    console.error("Response generation failed", error);
    return NextResponse.json(
      { error: "I couldn't create a response. Check the API key and try again." },
      { status: 502 },
    );
  }
}
