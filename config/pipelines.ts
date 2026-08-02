import { AudioLines, BrainCircuit, Ear, MessageSquareText, Radio, Speech } from "lucide-react";
import type { PipelineStageDefinition } from "@/types/pipeline";

export const cascadedStages: PipelineStageDefinition[] = [
  { id: "user-audio", label: "User Audio", shortLabel: "Listen", description: "Spoken input enters the system.", placeholderLatency: "— ms", status: "ready", icon: AudioLines },
  { id: "speech-to-text", label: "Speech-to-Text", shortLabel: "Transcribe", description: "Audio becomes written language.", placeholderLatency: "— ms", status: "idle", icon: Ear },
  { id: "language-model", label: "Language Model", shortLabel: "Reason", description: "Text is interpreted and answered.", placeholderLatency: "— ms", status: "idle", icon: BrainCircuit },
  { id: "text-to-speech", label: "Text-to-Speech", shortLabel: "Synthesize", description: "The answer becomes spoken audio.", placeholderLatency: "— ms", status: "idle", icon: MessageSquareText },
  { id: "assistant-audio", label: "Assistant Audio", shortLabel: "Speak", description: "The listener hears the response.", placeholderLatency: "— ms", status: "idle", icon: Speech },
];

export const realtimeStages: PipelineStageDefinition[] = [
  { id: "user-audio", label: "User Audio", shortLabel: "Listen", description: "Voice enters as rich audio.", placeholderLatency: "— ms", status: "ready", icon: AudioLines },
  { id: "realtime-model", label: "Realtime Model", shortLabel: "Listen · Reason · Speak", description: "One multimodal model works directly with audio in and audio out.", placeholderLatency: "— ms", status: "idle", icon: Radio },
  { id: "assistant-audio", label: "Assistant Audio", shortLabel: "Respond", description: "Voice returns in the same live flow.", placeholderLatency: "— ms", status: "idle", icon: Speech },
];
