"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Send, Square, Volume2 } from "lucide-react";
import { voiceDefaults } from "@/config/models";

export type VoiceStage = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  scenarioId: string;
  onStageChange: (stage: VoiceStage) => void;
  onTiming: (stage: string, duration: number) => void;
}

const stageCopy: Record<VoiceStage, string> = {
  idle: "Press the microphone and start talking",
  listening: "Listening… press stop when you're done",
  transcribing: "Turning your voice into text…",
  thinking: "Thinking about your answer…",
  speaking: "Speaking…",
  error: "Something went wrong. Try again.",
};

function supportedMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "The voice service is unavailable right now.";
}

export function VoiceConsole({ scenarioId, onStageChange, onTiming }: Props) {
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const safetyIdentifierRef = useRef("");

  useEffect(() => {
    safetyIdentifierRef.current = window.crypto.randomUUID();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current?.pause();
    };
  }, []);

  function updateStage(nextStage: VoiceStage) {
    setStage(nextStage);
    onStageChange(nextStage);
  }

  async function measured<T>(name: string, action: () => Promise<T>) {
    const startedAt = performance.now();
    try {
      return await action();
    } finally {
      onTiming(name, Math.round(performance.now() - startedAt));
    }
  }

  async function generateResponse(userText: string) {
    setError("");
    const priorMessages = messages.slice(-10);
    setMessages((current) => [...current, { role: "user", content: userText }]);
    updateStage("thinking");

    try {
      const response = await measured("language-model", () =>
        fetch("/api/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: userText,
            scenarioId,
            history: priorMessages,
            safetyIdentifier: safetyIdentifierRef.current,
          }),
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
        }),
      );

      if (!speechResponse.ok) throw new Error(await readError(speechResponse));
      const audioUrl = URL.createObjectURL(await speechResponse.blob());
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        updateStage("idle");
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        updateStage("idle");
      };
      await audio.play();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The voice service is unavailable.");
      updateStage("error");
    }
  }

  async function processRecording(blob: Blob) {
    updateStage("transcribing");
    try {
      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", blob, `recording.${extension}`);
      const response = await measured("speech-to-text", () =>
        fetch("/api/transcribe", { method: "POST", body: formData }),
      );
      if (!response.ok) throw new Error(await readError(response));
      const { text } = (await response.json()) as { text: string };
      if (!text) throw new Error("I couldn't hear any speech. Please try again.");
      await generateResponse(text);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "I couldn't process that recording.");
      updateStage("error");
    }
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setShowTextInput(true);
      setError("This browser cannot record audio. Type your message instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = supportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        void processRecording(blob);
      };
      recorder.start();
      updateStage("listening");
      timerRef.current = setTimeout(stopRecording, voiceDefaults.maxRecordingMs);
    } catch {
      setShowTextInput(true);
      setError("Microphone access was blocked. Allow it in your browser or type instead.");
      updateStage("error");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function submitText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = textInput.trim();
    if (!message || !["idle", "error"].includes(stage)) return;
    setTextInput("");
    void generateResponse(message);
  }

  const busy = !["idle", "error", "listening"].includes(stage);

  return (
    <section aria-labelledby="conversation-heading" className="rounded-[2rem] border border-slate-200 bg-white px-5 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:px-8 sm:py-9">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium text-blue-700">Live voice agent</p>
        <h2 id="conversation-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">Have a real conversation</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Your recording is transcribed, answered, and spoken back. Recordings are limited to 30 seconds.</p>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={stage === "listening" ? stopRecording : startRecording}
            disabled={busy}
            aria-label={stage === "listening" ? "Stop recording" : "Start recording"}
            className={`group grid size-24 place-items-center rounded-full text-white shadow-lg transition disabled:cursor-wait disabled:opacity-60 ${stage === "listening" ? "animate-pulse bg-rose-500 shadow-rose-200" : "bg-blue-600 shadow-blue-200 hover:-translate-y-0.5 hover:bg-blue-700"}`}
          >
            {stage === "listening" ? <Square className="size-8 fill-current" /> : <Mic className="size-9" />}
          </button>
        </div>
        <p className="mt-4 min-h-6 text-sm font-medium text-slate-700" aria-live="polite">{stageCopy[stage]}</p>
        {error ? <p className="mx-auto mt-2 max-w-lg text-sm text-rose-600" role="alert">{error}</p> : null}

        <button type="button" onClick={() => setShowTextInput((current) => !current)} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
          <Keyboard className="size-4" />{showTextInput ? "Hide keyboard" : "Prefer to type?"}
        </button>

        {showTextInput ? (
          <form onSubmit={submitText} className="mx-auto mt-4 flex max-w-xl gap-2">
            <label htmlFor="message" className="sr-only">Message the voice agent</label>
            <input id="message" value={textInput} onChange={(event) => setTextInput(event.target.value)} placeholder="Ask anything…" maxLength={4000} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            <button type="submit" disabled={!textInput.trim() || busy} aria-label="Send message" className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Send className="size-4" /></button>
          </form>
        ) : null}
      </div>

      {messages.length ? (
        <div className="mx-auto mt-9 max-w-3xl border-t border-slate-100 pt-7" aria-label="Conversation transcript">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-left text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}>
                  <span className="sr-only">{message.role === "user" ? "You" : "Assistant"}: </span>{message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400"><Volume2 className="size-3.5" />The voice you hear is AI-generated.</p>
    </section>
  );
}
