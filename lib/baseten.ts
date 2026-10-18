import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

export function hasBasetenKey() {
  return Boolean(process.env.BASETEN_API_KEY?.trim());
}

export function getBaseten() {
  const apiKey = process.env.BASETEN_API_KEY?.trim();
  if (!apiKey) throw new Error("BASETEN_API_KEY is not configured");

  return createOpenAI({
    apiKey,
    baseURL: "https://inference.baseten.co/v1",
    name: "baseten",
  });
}
