/** GPT-Live requires the complete local offer, including gathered ICE candidates. */
export async function waitForIce(peer: RTCPeerConnection, signal: AbortSignal) {
  signal.throwIfAborted();
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); peer.removeEventListener("icegatheringstatechange", changed); signal.removeEventListener("abort", aborted); };
    const changed = () => { if (peer.iceGatheringState === "complete") { cleanup(); resolve(); } };
    const aborted = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Timed out connecting audio. Try again.")); }, 10_000);
    peer.addEventListener("icegatheringstatechange", changed);
    signal.addEventListener("abort", aborted, { once: true });
    changed();
  });
}

/** A negotiated SDP alone does not mean the voice service started successfully. */
export async function waitForVoiceSession(channel: RTCDataChannel, live: boolean, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!live && channel.readyState === "open") return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      channel.removeEventListener("open", opened);
      channel.removeEventListener("message", message);
      channel.removeEventListener("close", closed);
      signal.removeEventListener("abort", aborted);
    };
    const started = () => { cleanup(); resolve(); };
    const opened = () => { if (!live) started(); };
    const message = ({ data }: MessageEvent<string>) => {
      let event;
      try { event = JSON.parse(data); } catch { return; }
      if (live && event.type === "session.started") started();
    };
    const closed = () => { cleanup(); reject(new Error("The voice connection closed during startup.")); };
    const aborted = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Voice session startup timed out. Reconnect to try again.")); }, 30_000);
    channel.addEventListener("open", opened);
    channel.addEventListener("message", message);
    channel.addEventListener("close", closed);
    signal.addEventListener("abort", aborted, { once: true });
  });
}
