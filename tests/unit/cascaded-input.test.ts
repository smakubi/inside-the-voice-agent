import { afterEach, expect, it, vi } from "vitest";
const hardware = vi.hoisted(() => ({ options: {} as Partial<import("@ricky0123/vad-web").RealTimeVADOptions>, start: vi.fn(async () => {}), pause: vi.fn(async () => {}), destroy: vi.fn(async () => {}) }));
vi.mock("@ricky0123/vad-web", () => ({ MicVAD: { new: async (options: Partial<import("@ricky0123/vad-web").RealTimeVADOptions>) => {
  hardware.options = options;
  return { start: hardware.start, pause: hardware.pause, destroy: hardware.destroy };
} } }));
import { CascadedInput } from "@/lib/cascaded-input";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("streams microphone audio, commits once at VAD end, and reuses the connection after playback", async () => {
  const channel = new EventTarget() as EventTarget & { readyState: string; send: (text: string) => void; close: () => void };
  channel.readyState = "open";
  const sent: string[] = [];
  channel.send = (data) => sent.push(JSON.parse(data).type);
  channel.close = vi.fn();
  let peerClosed = false;
  vi.stubGlobal("RTCPeerConnection", class extends EventTarget {
    iceGatheringState = "complete";
    connectionState = "connected";
    localDescription = { sdp: "offer" };
    addTrack() {}
    createDataChannel() { return channel; }
    async createOffer() { return { sdp: "offer", type: "offer" }; }
    async setLocalDescription() {}
    async setRemoteDescription() { channel.dispatchEvent(new Event("open")); }
    close() { peerClosed = true; }
  });
  vi.stubGlobal("fetch", async () => new Response("answer"));
  const track = { enabled: true, stop: vi.fn() };
  const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;
  const transcripts: string[] = [];
  const input = new CascadedInput({ onSpeechStart() {}, onSpeechEnd() {}, onPartial() {}, onTranscript: (text) => transcripts.push(text), onError: (message) => { throw new Error(message); } });
  await input.connect(stream, new AbortController().signal);
  expect(hardware.options.model).toBe("v6");
  hardware.options.onSpeechStart!();
  await hardware.options.onSpeechEnd!(new Float32Array(8000));
  expect(sent.filter((type) => type === "input_audio_buffer.commit")).toHaveLength(1);
  expect(track.enabled).toBe(false);
  const event = { type: "conversation.item.input_audio_transcription.completed", item_id: "turn_1", transcript: "Hello" };
  channel.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(event) }));
  channel.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(event) }));
  expect(transcripts).toEqual(["Hello"]);
  await input.resume();
  expect(track.enabled).toBe(true);
  expect(peerClosed).toBe(false);
  hardware.options.onSpeechStart!();
  await hardware.options.onSpeechEnd!(new Float32Array(8000));
  channel.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(event) }));
  expect(transcripts).toEqual(["Hello"]);
  channel.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ ...event, item_id: "turn_2", transcript: "Second turn" }) }));
  expect(transcripts).toEqual(["Hello", "Second turn"]);
  input.close();
  expect(peerClosed).toBe(true);
  expect(hardware.destroy).toHaveBeenCalled();
});
