import "server-only";

import OpenAI from "openai";

export function hasBasetenKey() {
  return Boolean(process.env.BASETEN_API_KEY?.trim());
}

export function getBaseten() {
  const apiKey = process.env.BASETEN_API_KEY?.trim();
  if (!apiKey) throw new Error("BASETEN_API_KEY is not configured");

  return new OpenAI({
    apiKey,
    baseURL: "https://inference.baseten.co/v1",
  });
}
