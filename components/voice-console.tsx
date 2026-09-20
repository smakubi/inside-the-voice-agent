"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Plus, Send, Square, Volume2 } from "lucide-react";
import { ArchitectureToggle } from "@/components/architecture-toggle";
import { CodeInspector } from "@/components/code-inspector";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { getCodeSnippet } from "@/config/code-snippets";
import { voiceDefaults } from "@/config/models";
import { PcmPlayer } from "@/lib/pcm-player";
import { runStreamedVoice } from "@/lib/streamed-voice";
import type { ArchitectureMode } from "@/types/pipeline";

export type VoiceStage = "idle" | "connecting" | "listening" | "transcribing" | "thinking" | "speaking" | "error";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface RealtimeFunctionCall {
  type: "function_call";
  name: string;
  call_id: string;
  arguments: string;
}

interface RealtimeServerEvent {
  type?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
  response?: { output?: RealtimeFunctionCall[] };
}

interface Props {
  architecture: ArchitectureMode;
  onArchitectureChange: (architecture: ArchitectureMode) => void;
}

const stageCopy: Record<VoiceStage, string> = {
  idle: "Start a conversation when you're ready",
  connecting: "Starting the voice session…",
  listening: "Listening — speak naturally and pause when you're done",
  transcribing: "Transcribing your message…",
  thinking: "Preparing a response…",
  speaking: "Responding…",
  error: "The session stopped. You can try again.",
};

const silenceThreshold = 0.025;
const silenceDurationMs = voiceDefaults.silenceDurationMs;

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
  const [streamingText, setStreamingText] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>();
  const messagesRef = useRef<ConversationMessage[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const turnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endOfSpeechAtRef = useRef<number | null>(null);
  const turnIdRef = useRef(0);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const realtimeSpeechStartedAtRef = useRef<number | null>(null);
  const realtimeResponseStartedAtRef = useRef<number | null>(null);
  const realtimeAudioStartedAtRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionActiveRef = useRef(false);
  const shouldProcessRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const silenceStartedRef = useRef<number | null>(null);
  const safetyIdentifierRef = useRef("");
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const turnId = turnIdRef;
    safetyIdentifierRef.current = window.crypto.randomUUID();
    return () => {
      sessionActiveRef.current = false;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
      shouldProcessRef.current = false;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
      turnId.current++;
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      void playerRef.current?.close();
      dataChannelRef.current?.close();
      peerConnectionRef.current?.close();
      remoteAudioRef.current?.pause();
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [messages.length, streamingText]);

  function updateStage(nextStage: VoiceStage) {
    setStage(nextStage);
  }

  function appendMessage(message: ConversationMessage) {
    const nextMessages = [...messagesRef.current, message];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }

  function getPlayer() {
    playerRef.current ??= new PcmPlayer();
    return playerRef.current;
  }

  function clearTurnMonitoring() {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = null;
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
    void playerRef.current?.close();
    playerRef.current = null;
    recordingStartedAtRef.current = null;
    realtimeSpeechStartedAtRef.current = null;
    realtimeResponseStartedAtRef.current = null;
    realtimeAudioStartedAtRef.current = null;
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
  }

  function endConversation() {
    turnIdRef.current++;
    setStreamingText("");
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    void playerRef.current?.close();
    playerRef.current = null;
    releaseSessionResources();
    setSessionActive(false);
    updateStage("idle");
  }

  function startNewConversation() {
    endConversation();
    messagesRef.current = [];
    setMessages([]);
    setTimings({});
    setError("");
  }

  function failSession(message: string) {
    releaseSessionResources();
    setSessionActive(false);
    setError(message);
    updateStage("error");
  }

  function handleArchitectureChange(nextArchitecture: ArchitectureMode) {
    if (nextArchitecture === architecture) return;
    endConversation();
    setSelectedStageId(undefined);
    setError("");
    onArchitectureChange(nextArchitecture);
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
      resumeTimeoutRef.current = setTimeout(() => {
        if (streamRef.current === stream) beginListening(stream);
      }, 100);
    } else {
      updateStage("idle");
    }
  }

  async function generateResponse(userText: string, continuous: boolean) {
    setError("");
    setStreamingText("");
    const priorMessages = messagesRef.current.slice(-10);
    appendMessage({ role: "user", content: userText });
    updateStage("thinking");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const turnId = ++turnIdRef.current;
    const startedAt = performance.now();
    const speechEndedAt = continuous ? endOfSpeechAtRef.current ?? startedAt : startedAt;
    const current = () => turnIdRef.current === turnId && !controller.signal.aborted;
    setTimings((previous): Record<string, number> => continuous ? {
      "speech-to-text": previous["speech-to-text"],
      "user-audio": previous["user-audio"],
    } : {});

    try {
      const player = getPlayer();
      await player.start();
      controller.signal.throwIfAborted();
      player.beginTurn(() => {
        if (!current()) return;
        setTimings((previous) => ({ ...previous, "first-audio": Math.round(performance.now() - speechEndedAt) }));
        updateStage("speaking");
      });
      const response = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText, history: priorMessages, safetyIdentifier: safetyIdentifierRef.current }),
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      const text = await runStreamedVoice({
        response, signal: controller.signal, player,
        onText: (partial) => { if (current()) setStreamingText(partial); },
        onFirstText: () => {
          if (current()) setTimings((previous) => ({ ...previous, "language-model": Math.round(performance.now() - startedAt) }));
        },
        onFirstSpeechByte: (latency) => {
          if (current()) setTimings((previous) => ({ ...previous, "text-to-speech": Math.round(latency) }));
        },
      });
      if (!current()) return;
      appendMessage({ role: "assistant", content: text });
      setStreamingText("");
      setTimings((previous) => ({ ...previous, "assistant-audio": Math.round(player.durationMs) }));
      if (continuous) resumeListening();
      else updateStage("idle");
    } catch (caughtError) {
      if (!current()) return;
      controller.abort();
      playerRef.current?.stop();
      setError(caughtError instanceof Error ? caughtError.message : "The voice service is unavailable.");
      releaseSessionResources();
      setSessionActive(false);
      updateStage("error");
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
      controller.signal.throwIfAborted();
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
    endOfSpeechAtRef.current = silenceStartedRef.current ?? performance.now();
    if (shouldProcess && recordingStartedAtRef.current !== null) {
      setTimings((current) => ({ ...current, "user-audio": Math.round(performance.now() - recordingStartedAtRef.current!) }));
    }
    recordingStartedAtRef.current = null;
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
    recordingStartedAtRef.current = performance.now();
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

  async function runRealtimeWebSearch(functionCall: RealtimeFunctionCall) {
    const dataChannel = dataChannelRef.current;
    if (!dataChannel || dataChannel.readyState !== "open") return;

    let output: string;
    try {
      const { query } = JSON.parse(functionCall.arguments) as { query?: string };
      if (!query?.trim()) throw new Error("The model did not provide a search query.");
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { result: string };
      output = body.result;
    } catch (caughtError) {
      output = caughtError instanceof Error ? `Web search failed: ${caughtError.message}` : "Web search failed.";
    }

    if (dataChannel.readyState !== "open") return;
    dataChannel.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: functionCall.call_id, output },
    }));
    dataChannel.send(JSON.stringify({ type: "response.create" }));
  }

  function finishRealtimeAudio() {
    const now = performance.now();
    if (realtimeResponseStartedAtRef.current !== null && realtimeAudioStartedAtRef.current === null) {
      setTimings((current) => ({ ...current, "realtime-model": Math.round(now - realtimeResponseStartedAtRef.current!) }));
      realtimeAudioStartedAtRef.current = now;
    }
    if (realtimeAudioStartedAtRef.current !== null) {
      setTimings((current) => ({ ...current, "assistant-audio": Math.max(1, Math.round(now - realtimeAudioStartedAtRef.current!)) }));
      realtimeAudioStartedAtRef.current = null;
    }
    realtimeResponseStartedAtRef.current = null;
    updateStage("listening");
  }

  function markRealtimeAudioStarted() {
    if (realtimeAudioStartedAtRef.current !== null) return;
    const now = performance.now();
    realtimeAudioStartedAtRef.current = now;
    if (realtimeResponseStartedAtRef.current !== null) {
      setTimings((current) => ({ ...current, "realtime-model": Math.round(now - realtimeResponseStartedAtRef.current!) }));
    }
    updateStage("speaking");
  }

  function handleRealtimeEvent(messageEvent: MessageEvent<string>) {
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(messageEvent.data) as typeof event;
    } catch {
      return;
    }

    if (event.type === "input_audio_buffer.speech_started") {
      realtimeSpeechStartedAtRef.current = performance.now();
      updateStage("listening");
    }
    if (event.type === "input_audio_buffer.speech_stopped") {
      if (realtimeSpeechStartedAtRef.current !== null) {
        setTimings((current) => ({ ...current, "user-audio": Math.round(performance.now() - realtimeSpeechStartedAtRef.current!) }));
      }
      realtimeSpeechStartedAtRef.current = null;
      realtimeResponseStartedAtRef.current = performance.now();
      realtimeAudioStartedAtRef.current = null;
      updateStage("thinking");
    }
    if (event.type === "response.created") updateStage("thinking");
    if (event.type === "response.output_audio.delta" || event.type === "response.output_audio_transcript.delta") markRealtimeAudioStarted();
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
      appendMessage({ role: "user", content: event.transcript.trim() });
    }
    if (event.type === "response.output_audio_transcript.done") {
      if (event.transcript?.trim()) appendMessage({ role: "assistant", content: event.transcript.trim() });
      finishRealtimeAudio();
    }
    if (event.type === "response.output_audio.done") finishRealtimeAudio();
    if (event.type === "response.done") {
      const functionCall = event.response?.output?.find((item) => item.type === "function_call" && item.name === "web_search");
      if (functionCall) {
        updateStage("thinking");
        void runRealtimeWebSearch(functionCall);
      } else finishRealtimeAudio();
    }
    if (event.type === "error") failSession(event.error?.message ?? "The realtime session stopped unexpectedly.");
  }

  async function startRealtimeConversation() {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setShowTextInput(true);
      setError("This browser does not support a realtime voice connection.");
      updateStage("error");
      return;
    }

    const startupId = ++turnIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const current = () => turnIdRef.current === startupId && !controller.signal.aborted;
    updateStage("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current()) { stream.getTracks().forEach((track) => track.stop()); return; }
      const peerConnection = new RTCPeerConnection();
      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudio.onplaying = markRealtimeAudioStarted;
      remoteAudioRef.current = remoteAudio;
      streamRef.current = stream;
      peerConnectionRef.current = peerConnection;
      sessionActiveRef.current = true;
      setSessionActive(true);

      peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
        void remoteAudio.play().catch(() => setError("Audio playback was blocked. Allow autoplay to hear the assistant."));
      };
      peerConnection.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(peerConnection.connectionState) && sessionActiveRef.current) {
          failSession("The realtime connection was interrupted. Start a new conversation to reconnect.");
        }
      };
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.addEventListener("message", (event) => { if (current()) handleRealtimeEvent(event); });
      dataChannel.addEventListener("open", () => {
        if (current()) updateStage("listening");
      });

      const offer = await peerConnection.createOffer();
      if (!current()) return;
      await peerConnection.setLocalDescription(offer);
      if (!current()) return;
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await readError(response));
      const answer = await response.text();
      if (!current()) return;
      await peerConnection.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (caughtError) {
      if (current()) failSession(caughtError instanceof Error ? caughtError.message : "The realtime session could not be started.");
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }

  async function startCascadedConversation() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setShowTextInput(true);
      setError("This browser cannot record audio. Type your message instead.");
      return;
    }

    const startupId = ++turnIdRef.current;
    updateStage("connecting");
    try {
      await getPlayer().start();
      if (turnIdRef.current !== startupId) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (turnIdRef.current !== startupId) { stream.getTracks().forEach((track) => track.stop()); return; }
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
      if (turnIdRef.current !== startupId) return;
      releaseSessionResources();
      setShowTextInput(true);
      setError("Microphone access was blocked. Allow it in your browser or type instead.");
      updateStage("error");
    }
  }

  function startConversation() {
    setError("");
    if (architecture === "realtime") void startRealtimeConversation();
    else void startCascadedConversation();
  }

  function submitText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = textInput.trim();
    const realtimeChannel = dataChannelRef.current;
    if (!message) return;
    if (architecture === "realtime" && realtimeChannel?.readyState === "open") {
      setTextInput("");
      appendMessage({ role: "user", content: message });
      realtimeResponseStartedAtRef.current = performance.now();
      updateStage("thinking");
      realtimeChannel.send(JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: message }] },
      }));
      realtimeChannel.send(JSON.stringify({ type: "response.create" }));
      return;
    }
    if (!["idle", "error"].includes(stage)) return;
    setTextInput("");
    void generateResponse(message, false);
  }

  const conversationBusy = sessionActive || ["connecting", "transcribing", "thinking", "speaking"].includes(stage);
  const textBusy = architecture === "realtime" ? dataChannelRef.current?.readyState !== "open" : !["idle", "error"].includes(stage);
  const selectedSnippet = selectedStageId ? getCodeSnippet(architecture, selectedStageId) : undefined;

  return (
    <>
    <section aria-label="Voice agent workspace" className="grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)] lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
      <div className="order-2 flex min-h-[620px] flex-col p-5 sm:p-8 lg:order-1 lg:border-r lg:border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">Conversation</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Speak naturally</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{architecture === "cascaded" ? "Start once, then talk normally. A short pause sends your turn, and the microphone resumes after each answer." : "Start once for a continuous, low-latency conversation over WebRTC."} The agent remembers earlier turns until you start a new conversation.</p>
          </div>
          <button type="button" onClick={startNewConversation} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"><Plus className="size-3.5" />New conversation</button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto rounded-2xl bg-slate-50 p-4 sm:p-5" aria-label="Conversation transcript">
          {messages.length || streamingText ? (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"}`}>
                    <span className="sr-only">{message.role === "user" ? "You" : "Assistant"}: </span>{message.content}
                  </div>
                </div>
              ))}
              {streamingText ? <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm ring-1 ring-slate-200" aria-label="Streaming assistant response">{streamingText}</div> : null}
              <div ref={transcriptEndRef} />
            </div>
          ) : (
            <div className="grid h-full min-h-48 place-items-center text-center"><p className="max-w-xs text-sm leading-6 text-slate-400">Your conversation will appear here.</p></div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button type="button" onClick={conversationBusy ? endConversation : startConversation} aria-label={conversationBusy ? "End conversation" : "Start conversation"} className={`mx-auto grid size-20 place-items-center rounded-full text-white shadow-lg transition hover:-translate-y-0.5 ${conversationBusy ? "bg-rose-500 shadow-rose-200 hover:bg-rose-600" : "bg-blue-600 shadow-blue-200 hover:bg-blue-700"}`}>
            {conversationBusy ? <Square className="size-6 fill-current" /> : <Mic className="size-7" />}
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
        <ArchitectureToggle value={architecture} onChange={handleArchitectureChange} />
        {architecture === "cascaded" && timings["first-audio"] !== undefined ? (
          <p className="mt-4 text-sm font-medium text-slate-700" role="status">Time to first audio: {timings["first-audio"]} ms<span className="mt-1 block text-xs font-normal text-slate-500">From the detected end of speech (or text submission) to playback start.</span></p>
        ) : null}
        <div className="mt-7 border-t border-slate-200 pt-6">
          <PipelineView architecture={architecture} activeStage={stage} timings={timings} selectedStageId={selectedStageId} onStageSelect={setSelectedStageId} />
        </div>
      </aside>
    </section>
    <CodeInspector snippet={selectedSnippet} onClose={() => setSelectedStageId(undefined)} />
    </>
  );
}
