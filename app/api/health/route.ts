import { NextResponse } from "next/server";
import { voiceModels } from "@/config/models";
import { hasOpenAIKey } from "@/lib/openai";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    configured: hasOpenAIKey(),
    models: voiceModels,
  });
}
