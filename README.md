# Inside the Voice Agent

A classroom-focused, working voice agent for comparing cascaded and native speech-to-speech architectures.

## Teaching views

- `/` runs the live voice demo and shows active stages and latency.
- `/architecture` walks through the execution graph and Python equivalent component by component.
- `/providers` compares native speech-to-speech providers with cascaded and hybrid platforms.

The live demo supports a cascaded OpenAI/Baseten pipeline and OpenAI Realtime over WebRTC. Server-side API keys are required for provider calls.

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
```

The application uses Next.js App Router, strict TypeScript, Tailwind CSS, Motion, Lucide icons, Vitest, Testing Library, and Playwright.
