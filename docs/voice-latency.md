# Voice streaming and latency

The demo keeps its existing models. Cascaded mode now streams LLM text to the browser as newline-delimited JSON (`text`, `done`, `error`). Complete sentences enter an ordered speech queue immediately. Unpunctuated spans are capped at 240 characters. Common abbreviations and decimals stay together; sentence segmentation is heuristic, so test your languages and domain vocabulary.

`/api/speak` forwards OpenAI's raw mono PCM response (24 kHz, signed 16-bit little-endian) without buffering the complete body. The browser handles network chunks that split a PCM sample, schedules 100 ms audio buffers, and keeps approximately one second scheduled ahead. Each sentence's synthesis starts after the preceding sentence's stream has been consumed, while its audio can still be playing. This bounds memory and preserves ordering without launching a request per token.

The silence threshold is 600 ms, down from 1,100 ms, in `config/models.ts`. This removes 500 ms of configured endpointing delay, but can end a turn prematurely for speakers who pause between words. Increase it if conversational testing shows cutoffs. Microphone echo cancellation and noise suppression are requested where supported. Input transcription still receives a completed recording; it is not streaming STT.

## Measurements

- **Speech-to-text latency:** browser request time to response headers.
- **First text:** response request through the first generated text delta.
- **First audio bytes:** first sentence's TTS request through its first nonempty PCM chunk.
- **Time to first audio:** detected silence onset (or keyboard submission) through scheduled playback start, including endpointing, transcription, network waits, and the initial audio buffer. This is a browser estimate, not a measurement at the speaker hardware.
- **Assistant audio duration:** duration calculated from played/scheduled PCM samples, excluding network gaps.

These stages overlap, so do not sum first-text and TTS metrics to infer total turn latency. Compare actual first-audio timings over repeated short/long turns, both warm and cold requests, using the same device and network. Report median and p95. No measured provider latency improvement is claimed until tested against live credentials.

## Cancellation and failures

End conversation, New conversation, architecture changes, and unmount cancel the current work and stop queued audio. Partial network responses require an explicit successful completion event. Empty model answers may retry once; a partially emitted answer never automatically retries. If synthesis fails, partial text remains visible but is not added to completed conversation history. The user can start a fresh turn.

Sentence-level TTS can introduce prosody changes between sentences and more provider requests. Tune chunk length against first-audio latency and naturalness. Cascaded mode remains half-duplex: it resumes microphone recording after playback. Native WebRTC mode supports model-managed interruptions.

## WebRTC, LiveKit, and Pipecat

The existing speech-to-speech mode already connects the browser directly to OpenAI over WebRTC, with server-side session setup and API credentials. Keep that mode as the reference for fluid conversation. WebRTC supplies media transport; it does not by itself remove buffering in an STT → LLM → TTS application.

For this classroom demo, retain the existing Next.js deployment and implement streaming directly. Migrating frameworks now adds deployment and operational work beyond the observed buffering problem.

For a production cascaded service requiring full-duplex audio, robust interruption handling, streaming STT, telephony, and provider switching, evaluate **LiveKit Agents** first for this TypeScript codebase. It has Node.js agents and WebRTC clients, but requires an agent server and LiveKit Cloud or a self-hosted media service. **Pipecat** is a strong alternative for a Python-based pipeline, also requiring a running bot service and transport. Neither framework has been installed or provisioned in this change.

Before production, address authentication and rate limits on provider-backed endpoints, session cost limits, provider timeouts, reconnect behavior, turn detection in noise, and telemetry without raw audio/transcript logging by default.

References:
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://developers.openai.com/api/docs/guides/realtime-vad
- https://docs.livekit.io/agents/start/voice-ai/
- https://docs.pipecat.ai/pipecat/deployment/overview
