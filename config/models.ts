export const voiceModels = {
  live: "gpt-live-1",
  liveBackend: "gpt-6-luna",
  liveTranscription: "gpt-live-transcribe",
  transcription: "gpt-transcribe",
  response: "zai-org/GLM-4.7",
  webSearch: "gpt-5.6-luna",
  speech: "gpt-4o-mini-tts",
  realtime: "gpt-realtime-2.1",
} as const;

export const voiceDefaults = {
  voice: "coral",
  silenceDurationMs: 400,
  maxRecordingMs: 30_000,
  maxAudioBytes: 10 * 1024 * 1024,
} as const;
