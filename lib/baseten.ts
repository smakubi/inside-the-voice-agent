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
    // The OpenAI adapter filters unknown provider options. Add Baseten's
    // documented template flag at the wire boundary, not as an ignored option.
    fetch: (url, init) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      return fetch(url, body?.model === "zai-org/GLM-4.7" ? {
        ...init, body: JSON.stringify({ ...body, chat_template_args: { enable_thinking: false } }),
      } : init);
    },
  });
}
