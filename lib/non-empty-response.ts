export async function generateNonEmptyResponse(
  generate: () => Promise<string>,
  attempts = 2,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const text = (await generate()).trim();
    if (text) return text;
  }

  throw new Error("The model returned an empty response");
}
