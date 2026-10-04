# Three voice architectures

The demo keeps three selectable modes and uses the current API contracts checked on 2026-10-04.

## Cascaded: live transcription → GLM → streaming TTS

One persistent WebRTC transcription session sends microphone audio to `gpt-live-transcribe` while the user speaks. The browser runs Silero VAD v6 through `@ricky0123/vad-web`; ONNX and worklet assets load from versioned CDN URLs. Model loading affects first-session startup, not each turn. Echo cancellation, noise suppression, and automatic gain control are requested where supported.

`gpt-live-transcribe` does not support `server_vad` or `semantic_vad`. Client VAD commits a turn after 400 ms of non-speech; it rejects very short misfires and limits a speaking turn to 30 seconds. A shorter silence interval can cut off slow speakers, so tune it using real conversations. VAD identifies speech, not semantic completion. No WAV upload is used in the active demo. `/api/transcribe` remains available for completed files.

Partial transcripts are displayed but never submitted speculatively to GLM. Final transcripts enter the separate Baseten `zai-org/GLM-4.7` response route. The actual provider request explicitly sets `chat_template_args.enable_thinking = false`, avoiding hidden reasoning before conversational output. This trades deep reasoning for response speed without changing the model.

The opening clause (at least 24 characters) or roughly 100-character opening phrase can start TTS before the full first sentence. Later sentences use the existing 240-character cap and preserve decimal/abbreviation handling. Short sentences still start immediately at their complete boundary. PCM is streamed at 24 kHz, signed 16-bit little-endian, with 100 ms scheduling buffers and about one second maximum playback lead. Requests stay ordered; cancellation stops all queued work. Phrase-level TTS may change prosody and adds provider calls.

Input is paused during response playback and resumes immediately afterward on the same connection. This mode is still half duplex. Full-duplex cascaded barge-in requires a separate orchestration design; this implementation does not claim it.

## Native Realtime: audio → gpt-realtime-2.1 → audio

The original native demo stays available. It uses WebRTC, minimal reasoning, eager semantic VAD (`eagerness: high`), and model-managed interruptions. Eagerness reduces endpoint waiting but increases the chance of responding during a long pause. Current-fact questions still use the demo's web-search function.

WebRTC output-buffer events, rather than transcript-done or response-done events, drive playback-stage status. Generation finishing does not mean the remote audio has finished playing. Native Realtime interruption support is different from GPT-Live's simultaneous listening and speaking.

## GPT-Live: full-duplex voice + delegated backend

The third demo creates `gpt-live-1` through `POST /v1/live/sessions`, with WebRTC transport and managed Responses delegation to `gpt-6-luna` using low reasoning effort and hosted web search. API credentials stay on Vercel. The server returns the opaque session ID and negotiated SDP answer. The client gathers ICE candidates and waits for `session.started`; it does not send Realtime commands or a second `session.start`.

Input stays active while remote audio plays. User and assistant captions update independently using `session.input_transcript.delta` and `session.output_transcript.delta`, preserving their exact spaces and session timestamps. There is no completed-turn event. Chat bubbles group nearby fragments for display only; they are not a record of completed spoken turns. Backend events are nested in `response.event` and can continue alongside conversation.

End conversation sends `session.close`, waits for `session.closed` and final voice usage, and then closes media. A 15-second timeout releases resources and reports unconfirmed final usage. New conversation, mode changes, or navigation send close where possible but release immediately; they do not claim confirmed usage. Voice usage is billed by session duration, and backend usage separately. This OpenAI project must have access to GPT-Live and the backend model; the UI reports access failures without silently substituting another mode.

## Measurements

Cascaded metrics are transcription finalization after commit, first model text, first TTS bytes, and detected end-of-speech to scheduled first playback. Transcription finalization excludes work already done while speaking. Audio duration is calculated from PCM samples and is not processing latency.

Realtime processing timing begins at the received speech-stopped event and ends at the server's output-buffer-started event; it excludes endpoint detection and is not a hardware speaker measurement. GPT-Live displays cumulative voice session duration and delegated backend latency, rather than inventing turn-based first-audio numbers for overlapping speech. Caption timing is not audio playback timing.

Compare warm and cold sessions, first-audio median and p95, cutoff rate, interruptions, and noisy environments on the same device/network. No measured latency improvement is claimed without live audio measurements.

## When LiveKit or Pipecat is useful

Neither framework is needed for these direct browser-to-OpenAI connections. WebRTC is media transport; VAD is speech detection; the separate reasoning model defines the cascade.

Use LiveKit Agents for a larger TypeScript/Python service needing rooms, telephony, agent workers, provider switching, and coordinated streaming interruption behavior. Use Pipecat for a Python audio pipeline with multiple transports/providers and explicit processing stages. These normally require an agent service running independently of short-lived Vercel requests. A framework does not automatically make batch transcription or fully buffered TTS fast.

## References

- https://developers.openai.com/api/docs/guides/realtime-transcription
- https://developers.openai.com/api/docs/guides/realtime-vad
- https://developers.openai.com/api/docs/guides/voice-webrtc
- https://developers.openai.com/api/docs/guides/live
- https://developers.openai.com/api/docs/guides/live-conversations
- https://developers.openai.com/api/docs/guides/live-delegation
- https://www.baseten.co/library/glm-4-7/
- https://docs.vad.ricky0123.com/user-guide/browser/
- https://docs.livekit.io/agents/
- https://docs.pipecat.ai/
