import { NextResponse } from "next/server";
import { voiceModels } from "@/config/models";
import { hasBasetenKey } from "@/lib/baseten";
import { hasOpenAIKey } from "@/lib/openai";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    configured: hasOpenAIKey() && hasBasetenKey(),
    providers: { openai: hasOpenAIKey(), baseten: hasBasetenKey() },
    models: voiceModels,
  });
}
