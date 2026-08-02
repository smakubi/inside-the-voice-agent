# Inside the Voice Agent

A classroom-focused interface for comparing cascaded and native speech-to-speech voice architectures.

## Milestone 1

This milestone is intentionally static. It includes the responsive teaching interface, architecture diagrams, scenario context, instructor control state, and inspector placeholders. It does not record audio, call AI providers, simulate pipeline execution, or require environment variables.

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
