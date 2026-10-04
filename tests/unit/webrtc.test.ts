import { afterEach, expect, it, vi } from "vitest";
import { waitForVoiceSession } from "@/lib/webrtc";

afterEach(() => vi.useRealTimers());

function channel() {
  return Object.assign(new EventTarget(), { readyState: "connecting" }) as RTCDataChannel;
}

it("waits for GPT-Live session.started rather than just the channel opening", async () => {
  const events = channel();
  let ready = false;
  const result = waitForVoiceSession(events, true, new AbortController().signal).then(() => { ready = true; });
  events.dispatchEvent(new Event("open"));
  await Promise.resolve();
  expect(ready).toBe(false);
  events.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "session.started" }) }));
  await result;
  expect(ready).toBe(true);
});

it("rejects startup when a connected transport never starts the voice session", async () => {
  vi.useFakeTimers();
  const result = waitForVoiceSession(channel(), true, new AbortController().signal);
  const rejected = expect(result).rejects.toThrow(/timed out/i);
  await vi.advanceTimersByTimeAsync(30_000);
  await rejected;
});

it("cancels pending startup immediately", async () => {
  const controller = new AbortController();
  const result = waitForVoiceSession(channel(), false, controller.signal);
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
});
