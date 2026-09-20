import type { ArchitectureMode } from "@/types/pipeline";

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
    path: "browser → audio turn",
    technology: "MediaRecorder + Web Audio API",
    note: "The browser demo uses MediaRecorder. This is the closest small Python equivalent for recording one turn.",
    code: `import sounddevice as sd
from scipy.io.wavfile import write

sample_rate = 16_000
seconds = 5
audio = sd.rec(
    int(seconds * sample_rate),
    samplerate=sample_rate,
    channels=1,
    dtype="int16",
)
sd.wait()
write("turn.wav", sample_rate, audio)`,
  },
  "cascaded:speech-to-text": {
    title: "Transcribe speech",
    path: "POST /api/transcribe",
    technology: "OpenAI · gpt-transcribe",
    note: "Upload the completed audio turn and read the returned transcript.",
    code: `from openai import OpenAI

client = OpenAI()

with open("turn.wav", "rb") as audio:
    transcript = client.audio.transcriptions.create(
        model="gpt-transcribe",
        file=audio,
    )

print(transcript.text)`,
  },
  "cascaded:language-model": {
    title: "Generate the answer",
    path: "POST /api/respond",
    technology: "Baseten · zai-org/GLM-4.7",
    note: "The TypeScript demo streams tokens from Baseten with Vercel AI SDK. Complete sentences start speech synthesis while the rest of the answer is still generating.",
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
        {"role": "user", "content": transcript.text},
    ],
    temperature=0.3,
    max_tokens=220,
    stream=True,
)

for chunk in stream:
    text = chunk.choices[0].delta.content or ""
    print(text, end="", flush=True)
    # Accumulate complete sentences for the speech queue.`,
  },
  "cascaded:text-to-speech": {
    title: "Synthesize speech",
    path: "POST /api/speak",
    technology: "OpenAI · gpt-4o-mini-tts",
    note: "Send each complete sentence to TTS. Forward raw PCM chunks immediately; the next sentence can synthesize while earlier audio plays.",
    code: `from openai import OpenAI
import sounddevice as sd

client = OpenAI()

with client.audio.speech.with_streaming_response.create(
    model="gpt-4o-mini-tts",
    voice="coral",
    input=sentence,  # A completed sentence from the text stream
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
    note: "The browser demo uses WebRTC and exposes a web_search function. This Python teaching equivalent shows the same tool configuration over a Realtime WebSocket.",
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
        "audio": {"output": {"voice": "marin"}},
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
    note: "WebRTC plays the remote media track automatically. A Python WebSocket client decodes each audio delta before playback.",
    code: `import base64
import json
import numpy as np
import sounddevice as sd

event = json.loads(ws.recv())
if event["type"] == "response.output_audio.delta":
    pcm = base64.b64decode(event["delta"])
    audio = np.frombuffer(pcm, dtype=np.int16)
    sd.play(audio, samplerate=24_000)`,
  },
};

export function getCodeSnippet(architecture: ArchitectureMode, stageId: string) {
  return snippets[`${architecture}:${stageId}`];
}
