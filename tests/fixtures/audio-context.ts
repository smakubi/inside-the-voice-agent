import { vi } from "vitest";

/** Only replace the browser audio hardware; exercise the real PCM player in UI tests. */
export function installAudioContext() {
  vi.stubGlobal("AudioContext", class {
    get currentTime() { return performance.now() / 1000; }
    state = "running";
    destination = {};
    async resume() { this.state = "running"; }
    async close() { this.state = "closed"; }
    createBuffer(_channels: number, length: number, rate: number) {
      return { duration: length / rate, copyToChannel() {} };
    }
    createBufferSource() {
      let timer: ReturnType<typeof setTimeout>;
      return { buffer: null as { duration: number } | null, onended: null as (() => void) | null,
        connect() {}, disconnect() {},
        start(time: number) { timer = setTimeout(() => this.onended?.(), Math.max(0, (time - performance.now() / 1000 + (this.buffer?.duration ?? 0)) * 1000)); },
        stop() { clearTimeout(timer); },
      };
    }
  });
}
