"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Send, Square, Volume2 } from "lucide-react";
import { ArchitectureToggle } from "@/components/architecture-toggle";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { voiceDefaults } from "@/config/models";
import type { ArchitectureMode } from "@/types/pipeline";

export type VoiceStage = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  architecture: ArchitectureMode;
  onArchitectureChange: (architecture: ArchitectureMode) => void;
}

const stageCopy: Record<VoiceStage, string> = {
  idle: "Start a conversation when you're ready",
  listening: "Listening — speak naturally and pause when you're done",
  transcribing: "Transcribing your message…",
  thinking: "Preparing a response…",
  speaking: "Responding…",
  error: "The session stopped. You can try again.",
};

const silenceThreshold = 0.025;
const silenceDurationMs = 1_100;

function supportedMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "The voice service is unavailable right now.";
}

export function VoiceConsole({ architecture, onArchitectureChange }: Props) {
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const turnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionActiveRef = useRef(false);
  const shouldProcessRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const silenceStartedRef = useRef<number | null>(null);
  const safetyIdentifierRef = useRef("");
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    safetyIdentifierRef.current = window.crypto.randomUUID();
    return () => {
      sessionActiveRef.current = false;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
      shouldProcessRef.current = false;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
      audioRef.current?.pause();
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  function updateStage(nextStage: VoiceStage) {
    setStage(nextStage);
  }

  function clearTurnMonitoring() {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
    animationFrameRef.current = null;
    turnTimeoutRef.current = null;
  }

  function releaseSessionResources() {
    sessionActiveRef.current = false;
    clearTurnMonitoring();
    shouldProcessRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }

  function endConversation() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    releaseSessionResources();
    setSessionActive(false);
    updateStage("idle");
  }

  async function measured<T>(name: string, action: () => Promise<T>) {
    const startedAt = performance.now();
    try {
      return await action();
    } finally {
      setTimings((current) => ({ ...current, [name]: Math.round(performance.now() - startedAt) }));
    }
  }

  function resumeListening() {
    const stream = streamRef.current;
    if (sessionActiveRef.current && stream?.active) {
      window.setTimeout(() => beginListening(stream), 250);
    } else {
      updateStage("idle");
    }
  }

  async function generateResponse(userText: string, continuous: boolean) {
    setError("");
    const priorMessages = messages.slice(-10);
    setMessages((current) => [...current, { role: "user", content: userText }]);
    updateStage("thinking");
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await measured("language-model", () =>
        fetch("/api/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: userText,
            history: priorMessages,
            safetyIdentifier: safetyIdentifierRef.current,
          }),
          signal: controller.signal,
        }),
      );

      if (!response.ok) throw new Error(await readError(response));
      const { text } = (await response.json()) as { text: string };
      setMessages((current) => [...current, { role: "assistant", content: text }]);
      updateStage("speaking");

      const speechResponse = await measured("text-to-speech", () =>
        fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        }),
      );

      if (!speechResponse.ok) throw new Error(await readError(speechResponse));
      const audioUrl = URL.createObjectURL(await speechResponse.blob());
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      const finishPlayback = () => {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        if (continuous) resumeListening();
        else updateStage("idle");
      };
      audio.onended = finishPlayback;
      audio.onerror = finishPlayback;

      try {
        await audio.play();
      } catch {
        setError("Audio playback was blocked, but the response is available in the transcript.");
        finishPlayback();
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      setError(caughtError instanceof Error ? caughtError.message : "The voice service is unavailable.");
      if (continuous) endConversation();
      else updateStage("error");
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }

  async function processRecording(blob: Blob) {
    updateStage("transcribing");
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `recording.${extension}`);
      const response = await measured("speech-to-text", () =>
        fetch("/api/transcribe", { method: "POST", body: formData, signal: controller.signal }),
      );
      if (!response.ok) throw new Error(await readError(response));
      const { text } = (await response.json()) as { text: string };
      if (!text) {
        resumeListening();
        return;
      }
      await generateResponse(text, true);
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      setError(caughtError instanceof Error ? caughtError.message : "I couldn't process that recording.");
      endConversation();
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }

  function finishTurn(shouldProcess: boolean) {
    clearTurnMonitoring();
    shouldProcessRef.current = shouldProcess;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function monitorAudio() {
    const analyser = analyserRef.current;
    if (!analyser || !sessionActiveRef.current) return;
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    const volume = Math.sqrt(sum / samples.length);
    const now = performance.now();

    if (volume > silenceThreshold) {
      speechDetectedRef.current = true;
      silenceStartedRef.current = null;
    } else if (speechDetectedRef.current) {
      silenceStartedRef.current ??= now;
      if (now - silenceStartedRef.current >= silenceDurationMs) {
        finishTurn(true);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(monitorAudio);
  }

  function beginListening(stream: MediaStream) {
    if (!sessionActiveRef.current || !stream.active) return;
    chunksRef.current = [];
    speechDetectedRef.current = false;
    silenceStartedRef.current = null;
    shouldProcessRef.current = false;
    const mimeType = supportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const shouldProcess = shouldProcessRef.current;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      recorderRef.current = null;
      if (shouldProcess && blob.size) void processRecording(blob);
      else if (sessionActiveRef.current) beginListening(stream);
    };
    recorder.start();
    updateStage("listening");
    monitorAudio();
    turnTimeoutRef.current = setTimeout(() => finishTurn(speechDetectedRef.current), voiceDefaults.maxRecordingMs);
  }

  async function startConversation() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setShowTextInput(true);
      setError("This browser cannot record audio. Type your message instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2_048;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sessionActiveRef.current = true;
      setSessionActive(true);
      beginListening(stream);
    } catch {
      setShowTextInput(true);
      setError("Microphone access was blocked. Allow it in your browser or type instead.");
      updateStage("error");
    }
  }

  function submitText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = textInput.trim();
    if (!message || !["idle", "error"].includes(stage)) return;
    setTextInput("");
    void generateResponse(message, false);
  }

  const textBusy = !["idle", "error"].includes(stage);

  return (
    <section aria-label="Voice agent workspace" className="grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)] lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
      <div className="order-2 flex min-h-[620px] flex-col p-5 sm:p-8 lg:order-1 lg:border-r lg:border-slate-200">
        <div>
          <p className="text-sm font-medium text-blue-700">Conversation</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Speak naturally</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Start once, then talk normally. A short pause sends your turn, and the microphone resumes after each answer.</p>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto rounded-2xl bg-slate-50 p-4 sm:p-5" aria-label="Conversation transcript">
          {messages.length ? (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"}`}>
                    <span className="sr-only">{message.role === "user" ? "You" : "Assistant"}: </span>{message.content}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          ) : (
            <div className="grid h-full min-h-48 place-items-center text-center"><p className="max-w-xs text-sm leading-6 text-slate-400">Your conversation will appear here.</p></div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button type="button" onClick={sessionActive ? endConversation : startConversation} aria-label={sessionActive ? "End conversation" : "Start conversation"} className={`mx-auto grid size-20 place-items-center rounded-full text-white shadow-lg transition hover:-translate-y-0.5 ${sessionActive ? "bg-rose-500 shadow-rose-200 hover:bg-rose-600" : "bg-blue-600 shadow-blue-200 hover:bg-blue-700"}`}>
            {sessionActive ? <Square className="size-6 fill-current" /> : <Mic className="size-7" />}
          </button>
          <p className="mt-3 min-h-6 text-sm font-medium text-slate-700" aria-live="polite">{stageCopy[stage]}</p>
          {error ? <p className="mx-auto mt-1 max-w-lg text-sm text-rose-600" role="alert">{error}</p> : null}
          <button type="button" onClick={() => setShowTextInput((current) => !current)} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><Keyboard className="size-4" />{showTextInput ? "Hide keyboard" : "Prefer to type?"}</button>
          {showTextInput ? (
            <form onSubmit={submitText} className="mx-auto mt-3 flex max-w-xl gap-2">
              <label htmlFor="message" className="sr-only">Message the voice agent</label>
              <input id="message" value={textInput} onChange={(event) => setTextInput(event.target.value)} placeholder="Ask anything…" maxLength={4000} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
              <button type="submit" disabled={!textInput.trim() || textBusy} aria-label="Send message" className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Send className="size-4" /></button>
            </form>
          ) : null}
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400"><Volume2 className="size-3.5" />The voice you hear is AI-generated.</p>
        </div>
      </div>

      <aside className="order-1 bg-slate-50/70 p-5 sm:p-8 lg:order-2" aria-label="Live architecture view">
        <ArchitectureToggle value={architecture} onChange={onArchitectureChange} />
        <div className="mt-7 border-t border-slate-200 pt-6">
          <PipelineView architecture={architecture} activeStage={stage} timings={timings} />
        </div>
      </aside>
    </section>
  );
}
