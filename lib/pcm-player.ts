import { PcmDecoder } from "@/lib/pcm-decoder";
import type { StreamingAudioPlayer } from "@/lib/streamed-voice";

const sampleRate = 24_000;
const frameSamples = 2_400; // 100 ms: small startup buffer, without thousands of tiny nodes.

function wait(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Schedule PCM as it arrives; never decode or buffer a complete audio file. */
export class PcmPlayer implements StreamingAudioPlayer {
  private readonly context = new AudioContext();
  private decoder = new PcmDecoder();
  private pending = new Float32Array(0);
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private started = false;
  private firstAudioTimer: ReturnType<typeof setTimeout> | undefined;
  private onStarted?: () => void;
  private closed = false;
  durationMs = 0;

  async start() {
    // Called in the click handler so browser autoplay policy sees the user gesture.
    if (this.context.state === "suspended") await this.context.resume();
    if (this.context.state !== "running") throw new Error("Audio playback is blocked. Start the conversation again to enable it.");
  }

  beginTurn(onStarted: () => void) {
    this.stop();
    this.started = false;
    this.durationMs = 0;
    this.onStarted = onStarted;
  }

  async enqueue(bytes: Uint8Array, signal: AbortSignal) {
    signal.throwIfAborted();
    const samples = this.decoder.push(bytes);
    const combined = new Float32Array(this.pending.length + samples.length);
    combined.set(this.pending);
    combined.set(samples, this.pending.length);
    this.pending = combined;
    while (this.pending.length >= frameSamples) {
      await this.schedule(this.pending.slice(0, frameSamples), signal);
      this.pending = this.pending.slice(frameSamples);
    }
  }

  async finishSentence(signal: AbortSignal) {
    this.decoder.finish();
    if (this.pending.length) await this.schedule(this.pending, signal);
    this.pending = new Float32Array(0);
    this.decoder = new PcmDecoder();
  }

  private async schedule(samples: Float32Array<ArrayBuffer>, signal: AbortSignal) {
    // Backpressure caps scheduled audio at about one second and bounds cancellation work.
    while (this.nextStart - this.context.currentTime > 1) {
      if (this.closed || this.context.state !== "running") throw new Error("Audio playback was interrupted.");
      await wait(50, signal);
    }
    signal.throwIfAborted();
    if (this.closed || this.context.state !== "running") throw new Error("Audio playback stopped. Start the conversation again.");
    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const start = Math.max(this.context.currentTime + 0.04, this.nextStart);
    this.nextStart = start + buffer.duration;
    this.durationMs += buffer.duration * 1000;
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    source.start(start);
    if (!this.started) {
      this.started = true;
      this.firstAudioTimer = setTimeout(() => {
        if (!this.closed && this.context.state === "running") this.onStarted?.();
      }, Math.max(0, (start - this.context.currentTime) * 1000));
    }
  }

  async drain(signal: AbortSignal) {
    while (this.sources.size) {
      if (this.context.state !== "running") throw new Error("Audio playback was interrupted.");
      await wait(25, signal);
    }
    signal.throwIfAborted();
  }

  stop() {
    clearTimeout(this.firstAudioTimer);
    this.onStarted = undefined;
    for (const source of this.sources) { source.stop(); source.disconnect(); }
    this.sources.clear();
    this.nextStart = 0;
    this.pending = new Float32Array(0);
    this.decoder = new PcmDecoder();
  }

  async close() {
    this.stop();
    if (!this.closed) { this.closed = true; await this.context.close(); }
  }
}
