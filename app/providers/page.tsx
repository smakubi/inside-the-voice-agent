import type { Metadata } from "next";
import { ArrowUpRight, Boxes, Radio, Route } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Voice AI Providers | Inside the Voice Agent",
  description: "A researched map of native speech-to-speech models and optimized cascaded voice AI platforms.",
};

interface Provider {
  name: string;
  product: string;
  description: string;
  strengths: string[];
  href: string;
}

const nativeProviders: Provider[] = [
  { name: "OpenAI", product: "GPT-Realtime 2.1", description: "A reasoning speech-to-speech model for WebRTC, WebSocket, and SIP voice agents.", strengths: ["Tool use", "Instruction following", "Noise and interruption handling"], href: "https://developers.openai.com/api/docs/models/gpt-realtime-2.1" },
  { name: "Google Cloud", product: "Gemini Live API", description: "Native audio models on Vertex AI for low-latency, bidirectional voice experiences.", strengths: ["Native audio", "Multimodal input", "Vertex AI deployment"], href: "https://cloud.google.com/vertex-ai/generative-ai/docs/live-api" },
  { name: "Amazon Web Services", product: "Nova 2 Sonic", description: "A speech-to-speech foundation model delivered through Amazon Bedrock for conversational AI.", strengths: ["Bidirectional streaming", "Tool use", "AWS integration"], href: "https://aws.amazon.com/nova/models/" },
  { name: "Microsoft Azure", product: "Voice Live API", description: "A managed voice-agent interface combining realtime models, speech services, and WebRTC.", strengths: ["Azure models", "Enterprise speech stack", "Avatar support"], href: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to" },
  { name: "Hume AI", product: "Empathic Voice Interface", description: "A speech-language system designed to understand vocal expression and respond with matching prosody.", strengths: ["Prosody understanding", "End-of-turn detection", "Emotionally expressive speech"], href: "https://dev.hume.ai/docs/speech-to-speech-evi/overview" },
];

const cascadedProviders: Provider[] = [
  { name: "LiveKit", product: "Agents", description: "An open-source realtime framework supporting STT–LLM–TTS, native realtime, and half-cascade architectures.", strengths: ["Provider plugins", "WebRTC infrastructure", "Python and Node.js"], href: "https://docs.livekit.io/agents/models/pipelines/" },
  { name: "Pipecat", product: "Voice AI framework", description: "An open-source Python framework that connects transport, STT, context, LLM, and TTS processors as streaming frames.", strengths: ["Python-first", "Composable processors", "Provider flexibility"], href: "https://docs.pipecat.ai/pipecat/learn/pipeline" },
  { name: "Vapi", product: "Voice agent platform", description: "A managed orchestration layer for swappable transcription, model, and voice providers, with telephony support.", strengths: ["Bring your own provider", "Telephony", "Managed scaling"], href: "https://docs.vapi.ai/quickstart/introduction" },
  { name: "Deepgram", product: "Voice Agent API", description: "A single WebSocket API that orchestrates listening, LLM inference, and speaking while preserving component configuration.", strengths: ["Integrated STT and TTS", "Single connection", "Self-hosting option"], href: "https://developers.deepgram.com/docs/voice-agent" },
  { name: "ElevenLabs", product: "ElevenAgents", description: "A managed agent platform combining speech recognition, an LLM, speech synthesis, turn-taking, and knowledge bases.", strengths: ["Voice quality", "Visual builder", "Interruption handling"], href: "https://elevenlabs.io/docs/agents-platform/overview" },
];

const developments = [
  { date: "2026", title: "OpenAI GPT-Realtime 2.1", detail: "Adds improved alphanumeric recognition, silence and noise handling, and interruption behavior over Realtime 2.", href: "https://developers.openai.com/api/docs/models/gpt-realtime-2.1" },
  { date: "May 2026", title: "Amazon Nova 2 Sonic updates", detail: "AWS reports improvements including fewer speech hallucinations and reduced speaker drift.", href: "https://docs.aws.amazon.com/nova/latest/nova2-userguide/release-notes.html" },
  { date: "2026 preview", title: "Azure Voice Live expands", detail: "Azure's current preview API unifies realtime voice models and speech services behind one interface.", href: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-api-reference-2026-06-01-preview" },
  { date: "Dec 2025", title: "Gemini native audio reaches GA", detail: "Google made Gemini 2.5 Flash Native Audio generally available through the Live API on Vertex AI.", href: "https://cloud.google.com/blog/products/ai-machine-learning/gemini-live-api-available-on-vertex-ai" },
];

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{provider.name}</p><h3 className="mt-2 text-lg font-semibold text-slate-950">{provider.product}</h3></div>
        <a href={provider.href} target="_blank" rel="noreferrer" aria-label={`Read ${provider.name} documentation`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:text-blue-700"><ArrowUpRight className="size-4" /></a>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{provider.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">{provider.strengths.map((strength) => <span key={strength} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{strength}</span>)}</div>
    </article>
  );
}

export default function ProvidersPage() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <SiteHeader />
        <section className="pb-10 pt-12 sm:pt-16">
          <p className="text-sm font-semibold text-blue-700">Market map · Updated August 2026</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">Voice AI provider landscape</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">A practical guide to providers that offer native speech-to-speech models and platforms that optimize the cascaded speech-to-text, large language model, and text-to-speech pipeline.</p>
        </section>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-3 sm:p-7">
          <div className="rounded-2xl bg-blue-50 p-5"><Radio className="size-5 text-blue-700" /><h2 className="mt-4 font-semibold text-slate-950">Native speech-to-speech</h2><p className="mt-2 text-sm leading-6 text-slate-600">Best for natural prosody, fast turn-taking, and direct audio understanding.</p></div>
          <div className="rounded-2xl bg-slate-100 p-5"><Route className="size-5 text-slate-700" /><h2 className="mt-4 font-semibold text-slate-950">Cascaded pipeline</h2><p className="mt-2 text-sm leading-6 text-slate-600">Best for component choice, text-level control, observability, and auditability.</p></div>
          <div className="rounded-2xl bg-emerald-50 p-5"><Boxes className="size-5 text-emerald-700" /><h2 className="mt-4 font-semibold text-slate-950">Half-cascade</h2><p className="mt-2 text-sm leading-6 text-slate-600">Native audio understanding paired with separate TTS for tighter output control.</p></div>
        </section>

        <section className="mt-12"><div className="max-w-2xl"><p className="text-sm font-semibold text-blue-700">Audio in, audio out</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Native speech-to-speech providers</h2></div><div className="mt-6 grid gap-4 md:grid-cols-2">{nativeProviders.map((provider) => <ProviderCard key={provider.product} provider={provider} />)}</div></section>
        <section className="mt-14"><div className="max-w-2xl"><p className="text-sm font-semibold text-blue-700">Optimized orchestration</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Cascaded and hybrid platforms</h2></div><div className="mt-6 grid gap-4 md:grid-cols-2">{cascadedProviders.map((provider) => <ProviderCard key={provider.product} provider={provider} />)}</div></section>

        <section className="mt-16 border-y border-slate-200 py-10">
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <p className="text-sm font-medium text-slate-500">Industry updates</p>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Recent developments</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Notable releases and platform changes across native voice models.</p>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-200">
            {developments.map((item) => (
              <a key={item.title} href={item.href} target="_blank" rel="noreferrer" className="group grid gap-2 border-b border-slate-200 py-5 sm:grid-cols-[9rem_1fr_auto] sm:gap-6">
                <p className="text-sm tabular-nums text-slate-500">{item.date}</p>
                <div>
                  <h3 className="font-semibold text-slate-950 group-hover:text-blue-700">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
                <ArrowUpRight className="mt-0.5 size-4 text-slate-400 transition group-hover:text-blue-700" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <section className="my-14 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold text-slate-950">Choose native when</h2><p className="mt-3 text-sm leading-6 text-slate-600">Conversational timing, vocal nuance, interruptions, and the most fluid user experience matter more than swapping individual providers.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold text-slate-950">Choose cascaded when</h2><p className="mt-3 text-sm leading-6 text-slate-600">You need exact transcripts, deterministic spoken wording, independent provider selection, detailed latency traces, or compliance review.</p></div></section>
        <footer className="py-8 text-center text-xs text-slate-400">Provider capabilities change quickly. Links point to each provider&apos;s official documentation.</footer>
      </div>
    </main>
  );
}
