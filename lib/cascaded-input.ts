import type { MicVAD } from "@ricky0123/vad-web";
import { voiceDefaults } from "@/config/models";
import { waitForIce } from "@/lib/webrtc";

interface Callbacks {
  onSpeechStart: () => void;
  onSpeechEnd: (endedAt: number, durationMs: number) => void;
  onPartial: (text: string) => void;
  onTranscript: (text: string, finalizationMs: number) => void;
  onError: (message: string) => void;
}

/** Stream once; commit turns with local neural VAD, then pause input during TTS. */
export class CascadedInput {
  private peer?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private vad?: MicVAD;
  private stream?: MediaStream;
  private closed = false;
  private paused = true;
  private waitingFinal = false;
  private committedAt = 0;
  private speechStartedAt = 0;
  private lastSpeechAt = 0;
  private partial = "";
  private completedItems = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private abortStartup?: () => void;
  constructor(private readonly callbacks: Callbacks) {}

  async connect(stream: MediaStream, signal: AbortSignal) {
    this.stream = stream;
    const peer = new RTCPeerConnection();
    this.peer = peer;
    const abort = () => this.close();
    this.abortStartup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    signal.throwIfAborted();
    for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
    const channel = peer.createDataChannel("oai-events");
    this.channel = channel;
    channel.addEventListener("message", ({ data }) => {
      if (this.closed) return;
      let event;
      try { event = JSON.parse(data); } catch { return; }
      if (event.type === "error" || event.type === "conversation.item.input_audio_transcription.failed") {
        this.callbacks.onError("Live transcription stopped. Start a new conversation to reconnect.");
      }
      if (event.type === "conversation.item.input_audio_transcription.delta" && !this.paused) {
        this.partial += event.delta ?? "";
        this.callbacks.onPartial(this.partial);
      }
      if (event.type === "conversation.item.input_audio_transcription.completed" && this.waitingFinal) {
        if (typeof event.item_id !== "string" || this.completedItems.has(event.item_id)) return;
        this.completedItems.add(event.item_id);
        this.waitingFinal = false;
        clearTimeout(this.timer);
        this.callbacks.onTranscript(event.transcript?.trim() ?? "", performance.now() - this.committedAt);
      }
    });
    peer.addEventListener("connectionstatechange", () => {
      if (!this.closed && ["failed", "disconnected"].includes(peer.connectionState)) this.callbacks.onError("The transcription connection was interrupted. Reconnect to continue.");
    });
    // Register before applying the answer; open can arrive during setRemoteDescription.
    const opened = new Promise<void>((resolve, reject) => {
      const done = () => { clearTimeout(timeout); channel.removeEventListener("open", open); signal.removeEventListener("abort", abortOpen); };
      const open = () => { done(); resolve(); };
      const abortOpen = () => { done(); reject(signal.reason); };
      const timeout = setTimeout(() => { done(); reject(new Error("Transcription connection timed out.")); }, 25_000);
      channel.addEventListener("open", open, { once: true });
      signal.addEventListener("abort", abortOpen, { once: true });
    });
    // Handle startup failures before the channel opens without an unhandled rejection.
    void opened.catch(() => {});
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIce(peer, signal);
      const response = await fetch("/api/transcription/session", {
        method: "POST", headers: { "Content-Type": "application/sdp" },
        body: peer.localDescription?.sdp ?? offer.sdp, signal,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Transcription connection failed.");
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
      await opened;
      signal.throwIfAborted();
      const { MicVAD } = await import("@ricky0123/vad-web");
      const vad = await MicVAD.new({
        model: "v6", startOnLoad: false,
        baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.31/dist/",
        onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/",
        redemptionMs: voiceDefaults.silenceDurationMs,
        preSpeechPadMs: 200, minSpeechMs: 160,
        getStream: async () => stream,
        // This class owns the shared track; VAD must never stop it on pause.
        pauseStream: async () => {}, resumeStream: async () => stream,
        onSpeechStart: () => {
          if (this.closed || this.paused) return;
          this.speechStartedAt = this.lastSpeechAt = performance.now();
          this.callbacks.onSpeechStart();
          this.timer = setTimeout(() => { void this.commit(); }, voiceDefaults.maxRecordingMs);
        },
        onFrameProcessed: (probabilities) => { if (probabilities.isSpeech >= 0.5) this.lastSpeechAt = performance.now(); },
        onSpeechEnd: () => this.commit(),
        onVADMisfire: () => { clearTimeout(this.timer); this.partial = ""; this.callbacks.onPartial(""); this.send("input_audio_buffer.clear"); },
      });
      if (this.closed || signal.aborted) { await vad.destroy(); throw signal.reason ?? new DOMException("Startup canceled", "AbortError"); }
      this.vad = vad;
      await this.resume();
    } catch (error) {
      this.close();
      throw error;
    } finally {
      this.abortStartup?.();
      this.abortStartup = undefined;
    }
  }

  private send(type: string) { if (this.channel?.readyState === "open") this.channel.send(JSON.stringify({ type })); }

  private async commit() {
    if (this.closed || this.paused || this.waitingFinal) return;
    this.paused = true;
    this.waitingFinal = true;
    clearTimeout(this.timer);
    this.committedAt = performance.now();
    this.callbacks.onSpeechEnd(this.lastSpeechAt || this.committedAt, this.committedAt - this.speechStartedAt);
    this.send("input_audio_buffer.commit");
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    await this.vad?.pause();
    if (this.closed || !this.waitingFinal) return;
    this.timer = setTimeout(() => { if (!this.closed && this.waitingFinal) this.callbacks.onError("Transcription took too long. Reconnect and try again."); }, 20_000);
  }

  async resume() {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.partial = "";
    this.waitingFinal = false;
    this.send("input_audio_buffer.clear");
    this.paused = false;
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = true; });
    await this.vad?.start();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.abortStartup?.();
    this.channel?.close();
    this.peer?.close();
    void this.vad?.destroy();
  }
}
