import { SentenceBuffer } from "@/lib/sentence-buffer";
import { readTextStream } from "@/lib/text-stream";

export interface StreamingAudioPlayer {
  enqueue(bytes: Uint8Array, signal: AbortSignal): Promise<void>;
  finishSentence(signal: AbortSignal): Promise<void>;
  drain(signal: AbortSignal): Promise<void>;
  stop(): void;
}

interface Options {
  response: Response;
  signal: AbortSignal;
  player: StreamingAudioPlayer;
  onText: (text: string) => void;
  onFirstText?: () => void;
  onFirstSpeechByte?: (latencyMs: number) => void;
  synthesize?: (text: string, signal: AbortSignal) => Promise<Response>;
}

/** Generate text and synthesize speech concurrently; play sentences strictly in order. */
export async function runStreamedVoice({ response, signal: parentSignal, player, onText, onFirstText, onFirstSpeechByte,
  synthesize = (text, signal) => fetch("/api/speak", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal,
  }),
}: Options): Promise<string> {
  const controller = new AbortController();
  const signal = controller.signal;
  const abort = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) abort();
  else parentSignal.addEventListener("abort", abort, { once: true });
  const sentences = new SentenceBuffer();
  let text = "";
  let speech = Promise.resolve();
  let speechError: unknown;
  let measuredSpeech = false;
  const stop = () => player.stop();
  signal.addEventListener("abort", stop, { once: true });
  // Cancel a blocked text read if speech fails or the user ends this turn.
  const textReader = readTextStream(response, signal);

  const queue = (sentence: string) => {
    speech = speech.then(async () => {
      signal.throwIfAborted();
      const started = performance.now();
      const audio = await synthesize(sentence, signal);
      signal.throwIfAborted();
      if (!audio.ok) {
        const body = await audio.json().catch(() => null);
        throw new Error(body?.error ?? "Speech generation failed.");
      }
      if (!audio.body) throw new Error("Speech generation returned no audio.");
      const reader = audio.body.getReader();
      const cancel = () => { void reader.cancel().catch(() => {}); };
      signal.addEventListener("abort", cancel, { once: true });
      let receivedAudio = false;
      try {
        while (true) {
          signal.throwIfAborted();
          const { done, value } = await reader.read();
          signal.throwIfAborted();
          if (done) break;
          if (!value.length) continue;
          receivedAudio = true;
          if (!measuredSpeech) {
            measuredSpeech = true;
            onFirstSpeechByte?.(performance.now() - started);
          }
          await player.enqueue(value, signal);
        }
        if (!receivedAudio) throw new Error("Speech generation returned empty audio.");
        await player.finishSentence(signal);
      } finally {
        signal.removeEventListener("abort", cancel);
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }).catch((error) => {
      // Attach a handler immediately: synthesis may fail while text is still streaming.
      speechError ??= error;
      controller.abort(error);
    });
  };

  try {
    for await (const delta of textReader) {
      signal.throwIfAborted();
      if (!text) onFirstText?.();
      text += delta;
      onText(text);
      for (const sentence of sentences.push(delta)) queue(sentence);
    }
    for (const sentence of sentences.flush()) queue(sentence);
    await speech;
    if (speechError) throw speechError;
    signal.throwIfAborted();
    if (!text.trim()) throw new Error("The model returned an empty answer.");
    await player.drain(signal);
    return text.trim();
  } catch (error) {
    controller.abort(error);
    await speech;
    throw speechError ?? error;
  } finally {
    signal.removeEventListener("abort", stop);
    parentSignal.removeEventListener("abort", abort);
  }
}
