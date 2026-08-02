import { AudioLines, BrainCircuit, Ear, MessageSquareText, Radio, Speech } from "lucide-react";
import { voiceModels } from "@/config/models";
import type { PipelineStageDefinition } from "@/types/pipeline";

export const cascadedStages: PipelineStageDefinition[] = [
  { id: "user-audio", label: "User Audio", shortLabel: "Listen", description: "Spoken input enters the system.", technology: "MediaRecorder + Web Audio API", placeholderLatency: "— ms", status: "ready", icon: AudioLines },
  { id: "speech-to-text", label: "Speech-to-Text", shortLabel: "Transcribe", description: "Audio becomes written language.", technology: `OpenAI · ${voiceModels.transcription}`, placeholderLatency: "— ms", status: "idle", icon: Ear },
  { id: "language-model", label: "Large Language Model", shortLabel: "Reason", description: "Text is interpreted and answered.", technology: `Baseten · ${voiceModels.response}`, placeholderLatency: "— ms", status: "idle", icon: BrainCircuit },
  { id: "text-to-speech", label: "Text-to-Speech", shortLabel: "Synthesize", description: "The answer becomes spoken audio.", technology: `OpenAI · ${voiceModels.speech}`, placeholderLatency: "— ms", status: "idle", icon: MessageSquareText },
  { id: "assistant-audio", label: "Assistant Audio", shortLabel: "Speak", description: "The listener hears the response.", technology: "Browser Audio API", placeholderLatency: "— ms", status: "idle", icon: Speech },
];

export const realtimeStages: PipelineStageDefinition[] = [
  { id: "user-audio", label: "User Audio", shortLabel: "Listen", description: "Voice enters as a live microphone track.", technology: "WebRTC microphone", placeholderLatency: "— ms", status: "ready", icon: AudioLines },
  { id: "realtime-model", label: "Realtime Model", shortLabel: "Listen · Reason · Speak", description: "One multimodal model works directly with audio in and audio out.", technology: `OpenAI · ${voiceModels.realtime} + web search`, placeholderLatency: "— ms", status: "idle", icon: Radio },
  { id: "assistant-audio", label: "Assistant Audio", shortLabel: "Respond", description: "Voice returns over the same live connection.", technology: "WebRTC audio stream", placeholderLatency: "— ms", status: "idle", icon: Speech },
];
