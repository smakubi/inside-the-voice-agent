# Inside the Voice Agent

A classroom-focused, working voice agent for comparing streaming cascaded, native Realtime, and full-duplex GPT-Live architectures.

## Teaching views

- `/` runs the live voice demo and shows active stages and latency.
- `/architecture` walks through the execution graph and Python equivalent component by component.
- `/providers` compares native speech-to-speech providers with cascaded and hybrid platforms.

The demo has three modes: live transcription → Baseten GLM → streaming TTS, native OpenAI Realtime, and full-duplex GPT-Live with Responses delegation. Server-side API keys are required for provider calls.

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
node --test tests/deploy-vercel.test.mjs
```

The application uses Next.js App Router, strict TypeScript, Tailwind CSS, Motion, Lucide icons, Vitest, Testing Library, and Playwright.

## Streaming voice

Cascaded mode streams microphone audio into gpt-live-transcribe over WebRTC and uses client Silero VAD v6 with a 400 ms pause. GLM thinking is disabled; the opening phrase starts streaming TTS early. Native Realtime uses eager semantic VAD. GPT-Live keeps input/output active simultaneously and delegates to gpt-6-luna with hosted web search. Model access must be enabled for your OpenAI project. VAD runtime assets load from pinned CDN URLs on first use.

See [voice streaming and latency](docs/voice-latency.md) for the wire format, timing definitions, tradeoffs, cancellation behavior, and the LiveKit/Pipecat recommendation.

## Production deployment

Pushing to `main` runs `.github/workflows/deploy-production.yml`. The workflow sends tracked source files to the Vercel deployment API, builds with the existing project's settings and production environment variables, and waits until `voice-ai-topaz.vercel.app` points to the ready deployment. Runs are serialized to avoid overlapping production releases.

GitHub Actions needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` repository secrets. Scope the token to the `voice-ai` project and replace the GitHub secret before its expiry. The API workflow avoids the CLI's account/team lookup that [currently fails with project-scoped tokens](https://github.com/vercel/vercel/issues/17506).

Only tracked files are uploaded; `.env`, `.env.*`, `.vercel/`, and `.github/` are excluded. The inline payload is limited to 4 MiB; larger projects should switch to Vercel's file-upload API. The deployment script requires a clean checkout of the GitHub Actions `main` commit and does not print credentials or API response bodies.
