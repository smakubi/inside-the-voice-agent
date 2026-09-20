import { afterEach, describe, expect, it, vi } from "vitest";
import { PcmPlayer } from "@/lib/pcm-player";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("PCM playback", () => {
  it("fails promptly if audio is suspended while applying backpressure", async () => {
    vi.useFakeTimers();
    let state = "running";
    vi.stubGlobal("AudioContext", class {
      currentTime = 0;
      get state() { return state; }
      destination = {};
      async resume() {}
      async close() {}
      createBuffer(_channels: number, length: number, rate: number) {
        return { duration: length / rate, copyToChannel() {} };
      }
      createBufferSource() { return { buffer: null, onended: null, connect() {}, disconnect() {}, start() {}, stop() {} }; }
    });
    const player = new PcmPlayer();
    await player.start();
    let firstAudio = false;
    player.beginTurn(() => { firstAudio = true; });
    const result = player.enqueue(new Uint8Array(57_600), new AbortController().signal);
    const assertion = expect(result).rejects.toThrow("Audio playback");
    await vi.advanceTimersByTimeAsync(5);
    state = "suspended";
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(firstAudio).toBe(false);
    await player.close();
  });

  it("schedules received audio before completion, in order, and stops all sources on cancel", async () => {
    vi.useFakeTimers();
    const scheduled: Array<{ start: number; stopped: boolean; onended?: () => void }> = [];
    const buffers: Float32Array[] = [];
    vi.stubGlobal("AudioContext", class {
      currentTime = 0;
      state = "running";
      destination = {};
      async resume() {}
      async close() { this.state = "closed"; }
      createBuffer(_channels: number, length: number, rate: number) {
        return { duration: length / rate, copyToChannel(data: Float32Array) { buffers.push(data); } };
      }
      createBufferSource() {
        const record = { start: 0, stopped: false, onended: undefined as (() => void) | undefined };
        scheduled.push(record);
        return { buffer: null, connect() {}, disconnect() {},
          start(time: number) { record.start = time; },
          stop() { record.stopped = true; },
          set onended(fn: () => void) { record.onended = fn; },
        };
      }
    });
    const player = new PcmPlayer();
    await player.start();
    let started = 0;
    player.beginTurn(() => { started++; });
    const controller = new AbortController();
    await player.enqueue(new Uint8Array(4800), controller.signal);
    expect(scheduled).toHaveLength(1);
    await player.enqueue(new Uint8Array(4800), controller.signal);
    expect(scheduled).toHaveLength(2);
    expect(scheduled[1].start).toBeCloseTo(scheduled[0].start + 0.1);
    expect(buffers[0]).toHaveLength(2400);
    await vi.advanceTimersByTimeAsync(100);
    expect(started).toBe(1);
    player.stop();
    expect(scheduled.every((s) => s.stopped)).toBe(true);
    await player.close();
  });
});
