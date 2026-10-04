"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Plus, Send, Square, Volume2 } from "lucide-react";
import { ArchitectureToggle } from "@/components/architecture-toggle";
import { CodeInspector } from "@/components/code-inspector";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { getCodeSnippet } from "@/config/code-snippets";
import { CascadedInput } from "@/lib/cascaded-input";
import { LiveTranscript } from "@/lib/live-transcript";
import { waitForIce, waitForVoiceSession } from "@/lib/webrtc";
import { PcmPlayer } from "@/lib/pcm-player";
import { runStreamedVoice } from "@/lib/streamed-voice";
import type { ArchitectureMode } from "@/types/pipeline";

export type VoiceStage = "idle" | "connecting" | "listening" | "transcribing" | "thinking" | "speaking" | "closing" | "error";

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
  closing: "Finishing the live session…",
  error: "The session stopped. You can try again.",
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "The voice service is unavailable right now.";
}

export function VoiceConsole({ architecture, onArchitectureChange }: Props) {
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [inputTranscript, setInputTranscript] = useState("");
  const [liveBackendBusy, setLiveBackendBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>();
  const messagesRef = useRef<ConversationMessage[]>([]);
  const cascadedInputRef = useRef<CascadedInput | null>(null);
  const liveActiveRef = useRef(false);
  const liveClosingRef = useRef(false);
  const liveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTranscriptRef = useRef(new LiveTranscript());
  const liveHistoryRef = useRef<ConversationMessage[]>([]);
  const liveDelegationsRef = useRef(new Map<string, number>());
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const endOfSpeechAtRef = useRef<number | null>(null);
  const turnIdRef = useRef(0);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const realtimeSpeechStartedAtRef = useRef<number | null>(null);
  const realtimeResponseStartedAtRef = useRef<number | null>(null);
  const realtimeAudioStartedAtRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionActiveRef = useRef(false);
  const safetyIdentifierRef = useRef("");
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const turnId = turnIdRef;
    safetyIdentifierRef.current = window.crypto.randomUUID();
    return () => {
      sessionActiveRef.current = false;
      cascadedInputRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (liveCloseTimerRef.current) clearTimeout(liveCloseTimerRef.current);
      if (liveActiveRef.current && dataChannelRef.current?.readyState === "open") dataChannelRef.current.send(JSON.stringify({ type: "session.close" }));
      turnId.current++;
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

  function releaseSessionResources() {
    sessionActiveRef.current = false;
    cascadedInputRef.current?.close();
    cascadedInputRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void playerRef.current?.close();
    playerRef.current = null;
    realtimeSpeechStartedAtRef.current = null;
    realtimeResponseStartedAtRef.current = null;
    realtimeAudioStartedAtRef.current = null;
    if (liveCloseTimerRef.current) clearTimeout(liveCloseTimerRef.current);
    liveCloseTimerRef.current = null;
    liveActiveRef.current = false;
    liveClosingRef.current = false;
    liveDelegationsRef.current.clear();
    setLiveBackendBusy(false);
    setInputTranscript("");
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

  function endConversation(force = false) {
    const channel = dataChannelRef.current;
    if (!force && liveActiveRef.current && channel?.readyState === "open") {
      if (liveClosingRef.current) return;
      liveClosingRef.current = true;
      streamRef.current?.getTracks().forEach((track) => { track.enabled = false; });
      updateStage("closing");
      channel.send(JSON.stringify({ type: "session.close" }));
      liveCloseTimerRef.current = setTimeout(() => {
        releaseSessionResources();
        setSessionActive(false);
        setError("The connection closed before final usage was confirmed.");
        updateStage("idle");
      }, 15_000);
      return;
    }
    if (liveActiveRef.current && channel?.readyState === "open") channel.send(JSON.stringify({ type: "session.close" }));
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
    endConversation(true);
    messagesRef.current = [];
    setMessages([]);
    setTimings({});
    setError("");
  }

  function failSession(message: string) {
    turnIdRef.current++;
    abortControllerRef.current?.abort();
    releaseSessionResources();
    setSessionActive(false);
    setError(message);
    updateStage("error");
  }

  function handleArchitectureChange(nextArchitecture: ArchitectureMode) {
    if (nextArchitecture === architecture) return;
    endConversation(true);
    setSelectedStageId(undefined);
    setError("");
    onArchitectureChange(nextArchitecture);
  }

  function resumeListening() {
    const input = cascadedInputRef.current;
    if (sessionActiveRef.current && input) {
      setInputTranscript("");
      void input.resume().then(() => {
        if (cascadedInputRef.current === input) updateStage("listening");
      }).catch(() => { if (cascadedInputRef.current === input) failSession("Microphone capture stopped. Reconnect to continue."); });
    } else updateStage("idle");
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

  function handleLiveEvent(messageEvent: MessageEvent<string>) {
    let event;
    try { event = JSON.parse(messageEvent.data); } catch { return; }
    if (event.type === "session.started") updateStage("listening");
    if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
      const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
      const captions = liveTranscriptRef.current.push(role, event.delta ?? "", event.start_ms, event.end_ms);
      const next = [...liveHistoryRef.current, ...captions];
      messagesRef.current = next;
      setMessages(next);
      // Transcript timing is not audio playback timing or a completed turn.
    }
    if (event.type === "session.delegation.created") {
      liveDelegationsRef.current.set(event.delegation_id, performance.now());
      setLiveBackendBusy(true);
    }
    if (event.type === "response.event" && ["response.completed", "response.failed", "response.incomplete"].includes(event.event?.type)) {
      const started = liveDelegationsRef.current.get(event.delegation_id);
      if (started !== undefined) setTimings((previous) => ({ ...previous, "live-backend": Math.round(performance.now() - started) }));
      liveDelegationsRef.current.delete(event.delegation_id);
      setLiveBackendBusy(liveDelegationsRef.current.size > 0);
    }
    if (event.type === "session.usage.updated" || event.type === "session.closed") {
      if (typeof event.usage?.seconds === "number") setTimings((previous) => ({ ...previous, "live-model": Math.round(event.usage.seconds * 1000) }));
    }
    if (event.type === "session.closed") {
      releaseSessionResources();
      setSessionActive(false);
      updateStage("idle");
    }
    if (event.type === "error") failSession(event.error?.message ?? "The GPT-Live session stopped unexpectedly.");
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
    if (event.type === "output_audio_buffer.started") markRealtimeAudioStarted();
    if (event.type === "output_audio_buffer.stopped" || event.type === "output_audio_buffer.cleared") finishRealtimeAudio();
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
      appendMessage({ role: "user", content: event.transcript.trim() });
    }
    if (event.type === "response.output_audio_transcript.done") {
      if (event.transcript?.trim()) appendMessage({ role: "assistant", content: event.transcript.trim() });
    }
    if (event.type === "response.done") {
      const functionCall = event.response?.output?.find((item) => item.type === "function_call" && item.name === "web_search");
      if (functionCall) {
        updateStage("thinking");
        void runRealtimeWebSearch(functionCall);
      }
    }
    if (event.type === "error") failSession(event.error?.message ?? "The realtime session stopped unexpectedly.");
  }

  async function startRealtimeConversation(useLive = false) {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!current()) { stream.getTracks().forEach((track) => track.stop()); return; }
      const peerConnection = new RTCPeerConnection();
      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;
      streamRef.current = stream;
      peerConnectionRef.current = peerConnection;
      sessionActiveRef.current = true;
      liveActiveRef.current = useLive;
      if (useLive) {
        liveTranscriptRef.current = new LiveTranscript();
        liveHistoryRef.current = [...messagesRef.current];
      }
      setSessionActive(true);

      peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = new MediaStream([event.track]);
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
      const ready = waitForVoiceSession(dataChannel, useLive, controller.signal);
      // SDP exchange can fail before we reach the readiness await.
      void ready.catch(() => {});
      dataChannel.addEventListener("message", (event) => { if (peerConnectionRef.current === peerConnection) { if (useLive) handleLiveEvent(event); else handleRealtimeEvent(event); } });
      dataChannel.addEventListener("open", () => {
        if (current() && !useLive) updateStage("listening");
      });
      dataChannel.addEventListener("close", () => {
        if (peerConnectionRef.current !== peerConnection || !sessionActiveRef.current) return;
        failSession(useLive
          ? "The GPT-Live connection closed before final usage was confirmed. Reconnect to continue."
          : "The realtime connection closed. Reconnect to continue.");
      });

      const offer = await peerConnection.createOffer();
      if (!current()) return;
      await peerConnection.setLocalDescription(offer);
      if (!current()) return;
      if (useLive) await waitForIce(peerConnection, controller.signal);
      const response = await fetch(useLive ? "/api/live/session" : "/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: peerConnection.localDescription?.sdp ?? offer.sdp,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await readError(response));
      const answer = useLive ? (await response.json()).transport.sdp : await response.text();
      if (!current()) return;
      await peerConnection.setRemoteDescription({ type: "answer", sdp: answer });
      await ready;
    } catch (caughtError) {
      if (current()) failSession(caughtError instanceof Error ? caughtError.message : "The realtime session could not be started.");
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }

  async function startCascadedConversation() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setShowTextInput(true);
      setError("This browser cannot stream microphone audio. Type your message instead.");
      return;
    }
    const startupId = ++turnIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    updateStage("connecting");
    try {
      await getPlayer().start();
      if (turnIdRef.current !== startupId) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (turnIdRef.current !== startupId) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const input = new CascadedInput({
        onSpeechStart: () => { if (cascadedInputRef.current === input) { setTimings({}); updateStage("listening"); } },
        onSpeechEnd: (endedAt, durationMs) => {
          if (cascadedInputRef.current !== input) return;
          endOfSpeechAtRef.current = endedAt;
          setTimings((previous) => ({ ...previous, "user-audio": Math.round(durationMs) }));
          updateStage("transcribing");
        },
        onPartial: (text) => { if (cascadedInputRef.current === input) setInputTranscript(text); },
        onTranscript: (text, latency) => {
          if (cascadedInputRef.current !== input || !sessionActiveRef.current) return;
          setInputTranscript("");
          setTimings((previous) => ({ ...previous, "speech-to-text": Math.round(latency) }));
          if (text) void generateResponse(text, true);
          else resumeListening();
        },
        onError: (message) => { if (cascadedInputRef.current === input) failSession(message); },
      });
      cascadedInputRef.current = input;
      await input.connect(stream, controller.signal);
      if (turnIdRef.current !== startupId) return;
      sessionActiveRef.current = true;
      setSessionActive(true);
      updateStage("listening");
    } catch (caughtError) {
      if (turnIdRef.current !== startupId || controller.signal.aborted) return;
      failSession(caughtError instanceof Error ? caughtError.message : "Microphone access was blocked. Allow it in your browser or type instead.");
      setShowTextInput(true);
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }

  function startConversation() {
    setError("");
    if (architecture === "realtime" || architecture === "live") void startRealtimeConversation(architecture === "live");
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
  const textBusy = architecture === "live" ? true : architecture === "realtime" ? !sessionActive || stage === "connecting" : !["idle", "error"].includes(stage);
  const selectedSnippet = selectedStageId ? getCodeSnippet(architecture, selectedStageId) : undefined;

  return (
    <>
    <section aria-label="Voice agent workspace" className="grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)] lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
      <div className="order-2 flex min-h-[620px] flex-col p-5 sm:p-8 lg:order-1 lg:border-r lg:border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">Conversation</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Speak naturally</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{architecture === "cascaded" ? "Audio streams to transcription while you speak. VAD sends your turn after a short pause; the microphone resumes after each answer." : architecture === "live" ? "Full duplex: keep speaking while the assistant talks. Input and output captions update independently." : "Start once for a continuous conversation over WebRTC, with eager turn detection and interruptions."} Conversation context is retained during the active session.</p>
          </div>
          <button type="button" onClick={startNewConversation} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"><Plus className="size-3.5" />New conversation</button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto rounded-2xl bg-slate-50 p-4 sm:p-5" aria-label="Conversation transcript">
          {messages.length || streamingText || inputTranscript ? (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"}`}>
                    <span className="sr-only">{message.role === "user" ? "You" : "Assistant"}: </span>{message.content}
                  </div>
                </div>
              ))}
              {inputTranscript ? <p className="ml-auto max-w-[88%] rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900" aria-live="polite">{inputTranscript}<span className="ml-2 text-xs text-blue-500">Live transcript</span></p> : null}
            {streamingText ? <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm ring-1 ring-slate-200" aria-label="Streaming assistant response">{streamingText}</div> : null}
              <div ref={transcriptEndRef} />
            </div>
          ) : (
            <div className="grid h-full min-h-48 place-items-center text-center"><p className="max-w-xs text-sm leading-6 text-slate-400">Your conversation will appear here.</p></div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button type="button" onClick={conversationBusy ? () => endConversation() : startConversation} disabled={stage === "closing"} aria-label={conversationBusy ? "End conversation" : "Start conversation"} className={`mx-auto grid size-20 place-items-center rounded-full text-white shadow-lg transition hover:-translate-y-0.5 ${conversationBusy ? "bg-rose-500 shadow-rose-200 hover:bg-rose-600" : "bg-blue-600 shadow-blue-200 hover:bg-blue-700"}`}>
            {conversationBusy ? <Square className="size-6 fill-current" /> : <Mic className="size-7" />}
          </button>
          <p className="mt-3 min-h-6 text-sm font-medium text-slate-700" aria-live="polite">{stageCopy[stage]}</p>
          {architecture === "live" && sessionActive ? <p className="mt-2 text-xs text-blue-700">Microphone remains open during assistant speech · {liveBackendBusy ? "Backend working" : "Backend ready"}</p> : null}
          {error ? <p className="mx-auto mt-1 max-w-lg text-sm text-rose-600" role="alert">{error}</p> : null}
          {architecture !== "live" ? <button type="button" onClick={() => setShowTextInput((current) => !current)} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><Keyboard className="size-4" />{showTextInput ? "Hide keyboard" : "Prefer to type?"}</button> : null}
          {showTextInput && architecture !== "live" ? (
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
