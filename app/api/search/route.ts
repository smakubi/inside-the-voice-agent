import { NextResponse } from "next/server";
import { z } from "zod";
import { voiceModels } from "@/config/models";
import { getOpenAI } from "@/lib/openai";

const requestSchema = z.object({
  query: z.string().trim().min(2).max(500),
});

export async function POST(request: Request) {
  try {
    const { query } = requestSchema.parse(await request.json());
    const response = await getOpenAI().responses.create({
      model: voiceModels.response,
      reasoning: { effort: "none" },
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      instructions: [
        `Today is ${new Date().toISOString().slice(0, 10)}.`,
        "Search the live web and return a concise, factual answer for a voice assistant.",
        "Prefer primary and authoritative sources. Include relevant dates and source names, but omit raw URLs.",
      ].join("\n"),
      input: query,
      max_output_tokens: 500,
    });

    const result = response.output_text.trim();
    if (!result) throw new Error("Web search returned no result");
    const spokenResult = result
      .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, "$1")
      .replace(/\*\*/g, "");
    return NextResponse.json({ result: spokenResult });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "That search query could not be processed." }, { status: 400 });
    }
    console.error("Web search failed", error);
    return NextResponse.json({ error: "Web search is unavailable right now." }, { status: 502 });
  }
}
