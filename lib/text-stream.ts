type TextEvent = { type: "text"; text: string } | { type: "done" } | { type: "error"; error: string };
const interrupted = "The answer stream was interrupted. Please try again.";

/** Explicit completion/error events distinguish a complete answer from a dropped connection. */
export function createTextStreamResponse(
  generate: (signal: AbortSignal) => AsyncIterable<string>,
  requestSignal: AbortSignal,
) {
  const controller = new AbortController();
  const signal = AbortSignal.any([requestSignal, controller.signal]);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(output) {
      const send = (event: TextEvent) => output.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          let receivedText = false;
          let leadingWhitespace = "";
          for await (const text of generate(signal)) {
            signal.throwIfAborted();
            if (!receivedText) {
              leadingWhitespace += text;
              if (!leadingWhitespace.trim()) continue;
              receivedText = true;
              send({ type: "text", text: leadingWhitespace });
              leadingWhitespace = "";
            } else if (text) send({ type: "text", text });
          }
          signal.throwIfAborted();
          if (receivedText) { send({ type: "done" }); return; }
        }
        send({ type: "error", error: "The model returned an empty answer. Please try again." });
      } catch {
        if (!signal.aborted) send({ type: "error", error: interrupted });
      } finally {
        if (!controller.signal.aborted) output.close();
      }
    },
    cancel() { controller.abort(); },
  });
  return new Response(body, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}

export async function* readTextStream(response: Response, signal?: AbortSignal): AsyncGenerator<string> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "The voice service is unavailable.");
  }
  if (!response.body) throw new Error(interrupted);
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      pending += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line) as TextEvent;
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "done") return;
        if (event.type !== "text" || typeof event.text !== "string") throw new Error(interrupted);
        yield event.text;
      }
      if (done || pending.length > 32_768) throw new Error(interrupted);
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
