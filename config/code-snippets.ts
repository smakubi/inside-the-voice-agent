import type { ArchitectureMode } from "@/types/pipeline";
import { voiceDefaults } from "@/config/models";

export interface CodeSnippet {
  title: string;
  path: string;
  technology: string;
  note: string;
  code: string;
}

const snippets: Record<string, CodeSnippet> = {
  "cascaded:user-audio": {
    title: "Capture user audio",
    path: "microphone → WebRTC transcription + client VAD",
    technology: "WebRTC + Silero VAD v6",
    note: `The browser shares one microphone stream between WebRTC and Silero VAD v6. Audio reaches gpt-live-transcribe while you speak; ${voiceDefaults.silenceDurationMs} ms of non-speech commits the turn. Input pauses during the separate GLM/TTS response. This Python equivalent uses WebSocket PCM and WebRTC VAD; it does not create or upload a WAV file. Run the transcription setup first.`,
    code: `import base64
import numpy as np
import sounddevice as sd
import webrtcvad
from scipy.signal import resample_poly

vad = webrtcvad.Vad(2)
frame_samples = 320  # 20 ms at 16 kHz; valid WebRTC VAD geometry
quiet_frames = 0
speech_frames = 0
frames_since_speech = 0

with sd.RawInputStream(
    samplerate=16_000, channels=1, dtype="int16",
    blocksize=frame_samples,
) as microphone:
    while True:
        frame, overflowed = microphone.read(frame_samples)
        if overflowed:
            raise RuntimeError("Microphone overflow")
        pcm16 = bytes(frame)
        # Realtime PCM input is 24 kHz; VAD runs at 16 kHz.
        samples = np.frombuffer(pcm16, dtype="<i2").astype(np.float32)
        pcm24 = np.clip(resample_poly(samples, 3, 2), -32768, 32767)
        ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": base64.b64encode(pcm24.astype("<i2")).decode(),
        }))
        if vad.is_speech(pcm16, 16_000):
            speech_frames += 1
            quiet_frames = 0
        elif speech_frames >= 3:
            quiet_frames += 1
        if speech_frames >= 3:
            frames_since_speech += 1
        if quiet_frames >= ${voiceDefaults.silenceDurationMs / 20} or frames_since_speech >= 1500:
            ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
            break
# Read the final transcript, run GLM/TTS, then resume input.
# A production PCM resampler should preserve filter state across frames.`,
  },
  "cascaded:speech-to-text": {
    title: "Transcribe speech",
    path: "POST /api/transcription/session → persistent WebRTC",
    technology: "OpenAI · gpt-live-transcribe",
    note: "Live transcription emits partial text while audio arrives and final text after a commit. gpt-live-transcribe requires client-side VAD: server_vad and semantic_vad are unsupported for this model. The browser uses WebRTC; this Python setup uses a WebSocket and a reader thread alongside microphone capture. GLM receives only the final transcript.",
    code: `import json
import os
import queue
import threading
from websocket import create_connection

ws = create_connection(
    "wss://api.openai.com/v1/realtime?intent=transcription",
    header=[f"Authorization: Bearer {os.environ['OPENAI_API_KEY']}"],
)
ws.send(json.dumps({
    "type": "session.update",
    "session": {
        "type": "transcription",
        "audio": {"input": {
            "format": {"type": "audio/pcm", "rate": 24000},
            "transcription": {"model": "gpt-live-transcribe", "delay": "low"},
            "turn_detection": None,
        }},
    },
}))
ready = threading.Event()
final_transcripts = queue.Queue()

def read_events():
    while True:
        event = json.loads(ws.recv())
        if event["type"] == "session.updated":
            ready.set()
        elif event["type"] == "conversation.item.input_audio_transcription.delta":
            print(event["delta"], end="", flush=True)
        elif event["type"] == "conversation.item.input_audio_transcription.completed":
            final_transcripts.put(event["transcript"])
        elif event["type"] == "error":
            print(event["error"]["message"])
            return

threading.Thread(target=read_events, daemon=True).start()
if not ready.wait(timeout=10):
    raise RuntimeError("Transcription session did not become ready")
# Run the microphone/VAD code, then:
# user_text = final_transcripts.get(timeout=20)`,
  },
  "cascaded:language-model": {
    title: "Generate the answer",
    path: "POST /api/respond",
    technology: "Baseten · zai-org/GLM-4.7",
    note: "The TypeScript demo streams tokens from Baseten with Vercel AI SDK. The opening clause starts TTS before the full sentence is ready; later sentences preserve more context. Thinking is explicitly disabled using Baseten’s chat_template_args parameter.",
    code: `import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["BASETEN_API_KEY"],
    base_url="https://inference.baseten.co/v1",
)

stream = client.chat.completions.create(
    model="zai-org/GLM-4.7",
    messages=[
        {"role": "system", "content": "Reply naturally in 1–3 sentences."},
        {"role": "user", "content": user_text},
    ],
    temperature=0.3,
    max_tokens=220,
    extra_body={"chat_template_args": {"enable_thinking": False}},
    stream=True,
)

for chunk in stream:
    text = chunk.choices[0].delta.content or ""
    print(text, end="", flush=True)
    # Queue the opening clause, then complete sentences, for TTS.`,
  },
  "cascaded:text-to-speech": {
    title: "Synthesize speech",
    path: "POST /api/speak",
    technology: "OpenAI · gpt-4o-mini-tts",
    note: "Send the opening phrase, then completed sentences, to TTS. Forward raw PCM chunks immediately; the next sentence can synthesize while earlier audio plays.",
    code: `from openai import OpenAI
import sounddevice as sd

client = OpenAI()

with client.audio.speech.with_streaming_response.create(
    model="gpt-4o-mini-tts",
    voice="coral",
    input=phrase,  # Opening phrase or later sentence from the text stream
    response_format="pcm",
) as response:
    with sd.RawOutputStream(
        samplerate=24_000, channels=1, dtype="int16"
    ) as speaker:
        for chunk in response.iter_bytes(chunk_size=4_800):
            speaker.write(chunk)`,
  },
  "cascaded:assistant-audio": {
    title: "Play assistant audio",
    path: "audio response → browser",
    technology: "Streaming PCM · Web Audio API",
    note: "The browser schedules 100 ms PCM buffers on a single audio timeline, preserves sentence order, and limits queued audio to about one second. This Python equivalent plays incoming PCM directly.",
    code: `import sounddevice as sd

with sd.RawOutputStream(
    samplerate=24_000, channels=1, dtype="int16"
) as speaker:
    for pcm_chunk in incoming_pcm_chunks:
        speaker.write(pcm_chunk)
    # Stop/close the stream when the conversation ends.`,
  },
  "realtime:user-audio": {
    title: "Stream microphone audio",
    path: "microphone → WebRTC track",
    technology: "WebRTC microphone",
    note: "The live demo sends the browser microphone track over WebRTC. A Python client can stream PCM frames from sounddevice.",
    code: `import sounddevice as sd

def on_audio(indata, frames, time, status):
    pcm_bytes = bytes(indata)
    send_audio_frame(pcm_bytes)

stream = sd.RawInputStream(
    samplerate=24_000,
    channels=1,
    dtype="int16",
    callback=on_audio,
)
stream.start()`,
  },
  "realtime:realtime-model": {
    title: "Run speech-to-speech",
    path: "WebRTC → gpt-realtime-2.1",
    technology: "OpenAI · gpt-realtime-2.1 + web search",
    note: "Native Realtime uses eager semantic VAD, minimal reasoning, and model-managed barge-in. Eagerness high reduces endpoint waiting but can interrupt long pauses. The WebRTC output-buffer events track audio separately from transcript generation. This Python setup uses the equivalent WebSocket protocol.",
    code: `import json
import os
from websocket import create_connection

ws = create_connection(
    "wss://api.openai.com/v1/realtime"
    "?model=gpt-realtime-2.1",
    header=[f"Authorization: Bearer {os.environ['OPENAI_API_KEY']}"],
)

ws.send(json.dumps({
    "type": "session.update",
    "session": {
        "type": "realtime",
        "model": "gpt-realtime-2.1",
        "reasoning": {"effort": "minimal"},
        "output_modalities": ["audio"],
        "audio": {
            "input": {"turn_detection": {
                "type": "semantic_vad", "eagerness": "high",
                "create_response": True, "interrupt_response": True,
            }},
            "output": {"voice": "marin"},
        },
        "tools": [{
            "type": "function",
            "name": "web_search",
            "description": "Search the live web for current facts.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        }],
        "tool_choice": "auto",
    },
}))`,
  },
  "realtime:assistant-audio": {
    title: "Play streamed audio",
    path: "remote WebRTC track → speaker",
    technology: "WebRTC audio stream",
    note: "The browser plays a remote WebRTC track. output_audio_buffer.started/stopped describe its output buffer; a transcript-done or response-done event does not mean the speaker finished. A Python WebSocket client needs an ordered audio queue; repeatedly calling sd.play would interrupt earlier chunks.",
    code: `import base64
import queue
import threading
import sounddevice as sd

pcm_queue = queue.Queue(maxsize=20)

def play_audio():
    with sd.RawOutputStream(
        samplerate=24_000, channels=1, dtype="int16"
    ) as speaker:
        while True:
            pcm = pcm_queue.get()
            if pcm is None:
                break
            speaker.write(pcm)

threading.Thread(target=play_audio, daemon=True).start()
# Inside the existing event reader:
# if event["type"] == "response.output_audio.delta":
#     pcm_queue.put(base64.b64decode(event["delta"]))
# On interruption, clear queued audio and truncate the unheard response.
# On shutdown, enqueue None and join the playback worker.`,
  },
  "live:user-audio": {
    title: "Keep microphone input continuous",
    path: "microphone ↔ GPT-Live over WebRTC",
    technology: "WebRTC · echo cancellation",
    note: "Full duplex keeps input and output active simultaneously. The browser requests echo cancellation, adds the microphone track, gathers ICE candidates, and exchanges SDP through its server. No client silence gate pauses the microphone when the assistant speaks. This server-side Python example exchanges an offer supplied by the browser.",
    code: `import os
import requests

def create_live_session(browser_sdp):
    response = requests.post(
        "https://api.openai.com/v1/live/sessions",
        headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
        json={
            "session": session_config,  # Configuration in the next step
            "transport": {"type": "webrtc", "sdp": browser_sdp},
        },
        timeout=20,
    )
    response.raise_for_status()
    result = response.json()
    # Return this JSON to the browser; keep the API key on the server.
    # Browser applies result["transport"]["sdp"] as its answer.
    return result`,
  },
  "live:live-model": {
    title: "Run the full-duplex voice model",
    path: "POST /v1/live/sessions → gpt-live-1",
    technology: "OpenAI · gpt-live-1",
    note: "GPT-Live listens while speaking and delegates reasoning separately. HTTP session creation starts the session; wait for session.started on the data channel. Do not send Realtime response.create or a second session.start. WebRTC negotiates the audio format, so omit audio.format.",
    code: `session_config = {
    "model": "gpt-live-1",
    "instructions": (
        "Be concise. Listen while speaking and adapt to corrections. "
        "Answer simple questions directly. Delegate complex reasoning "
        "and current information to the backend."
    ),
    "audio": {"output": {"voice": "marin"}},
    "delegation": {
        "type": "responses",
        "responses": {
            "model": "gpt-6-luna",
            "instructions": "Return concise grounded results. Search for current facts.",
            "reasoning": {"effort": "low"},
            "max_output_tokens": 500,
            "tools": [{"type": "web_search"}],
            "tool_choice": "auto",
        },
    },
}`,
  },
  "live:live-backend": {
    title: "Delegate while the conversation continues",
    path: "GPT-Live → Responses backend → GPT-Live",
    technology: "Responses · gpt-6-luna + hosted web search",
    note: "Managed Responses delegation runs reasoning and hosted web search independently of speech. Backend events are nested in response.event. Backend completion is not spoken playback completion. Client delegation is an alternative for your own GLM, agent, or service; it requires application-owned task routing and context.",
    code: `import time

started = {}

def handle_backend_event(event):
    if event["type"] == "session.delegation.created":
        started[event["delegation_id"]] = time.monotonic()
    elif event["type"] == "response.event":
        nested = event["event"]
        if nested["type"] in (
            "response.completed", "response.failed", "response.incomplete"
        ):
            began = started.pop(event["delegation_id"], None)
            if began is not None:
                print("Backend latency:", time.monotonic() - began)
# Dispatch data-channel events here; the voice tracks remain active.
# Hosted web_search is managed by OpenAI; custom functions need your executor.`,
  },
  "live:assistant-audio": {
    title: "Play audio and display overlapping captions",
    path: "WebRTC media + independent timed transcript streams",
    technology: "WebRTC audio track · Live transcript events",
    note: "Audio arrives on the remote media track, not JSON audio deltas. Input and output transcript fragments have start_ms/end_ms and no completed-turn event. Keep both captions independent and preserve spaces exactly. End sends session.close; keep the transport alive until session.closed confirms final usage, then clean up. Abrupt navigation can leave final usage unconfirmed.",
    code: `captions = {"user": [], "assistant": []}

def handle_live_event(event):
    roles = {
        "session.input_transcript.delta": "user",
        "session.output_transcript.delta": "assistant",
    }
    role = roles.get(event["type"])
    if role:
        captions[role].append({
            "text": event["delta"],
            "start_ms": event["start_ms"],
            "end_ms": event["end_ms"],
        })
        text = "".join(part["text"] for part in
                       sorted(captions[role], key=lambda p: p["start_ms"]))
        print(role, text)
    elif event["type"] == "session.closed":
        print("Final voice usage:", event["usage"]["seconds"], "seconds")
        # Now close the data channel, peer connection, and microphone.
# Browser: events.send(JSON.stringify({type: "session.close"}))
# Register the session.closed handler before sending that command.
# Do not infer audio playback completion from transcript arrival.`,
  },
};

export function getCodeSnippet(architecture: ArchitectureMode, stageId: string) {
  return snippets[`${architecture}:${stageId}`];
}
