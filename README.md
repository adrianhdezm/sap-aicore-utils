# sap-aicore-utils

Monorepo for SAP AI Core Foundation Models tooling in the Vercel AI SDK ecosystem.

## What’s in this repo

Packages:

- [`packages/sap-aicore-provider/`](./packages/sap-aicore-provider) - Vercel AI SDK provider (`@ai-foundry/sap-aicore-provider`)
- [`packages/sap-aicore-nano-sdk/`](./packages/sap-aicore-nano-sdk) - Lightweight SDK helpers for SAP AI Core (`@ai-foundry/sap-aicore-nano-sdk`)

Examples:

- [`examples/basic/`](./examples/basic) - Basic `generateText` example
- [`examples/streaming/`](./examples/streaming) - Streaming `streamText` example
- [`examples/mastra-agents/`](./examples/mastra-agents) - Example using Mastra Agents with SAP AI Core
- [`examples/openai-agents/`](./examples/openai-agents) - Example using OpenAI Agents SDK with SAP AI Core

## Quick start

```bash
pnpm install
pnpm run build
```

## Common commands

```bash
pnpm run ci:check     # Full CI validation
pnpm run build        # Build all packages with tsup
pnpm run test         # Run vitest tests
pnpm run typecheck    # TypeScript type checking
pnpm run lint         # ESLint across all packages
pnpm run format       # Format with Prettier
pnpm run format:check # Check formatting
```

## Run examples

```bash
pnpm --filter basic-example start
pnpm --filter streaming-example start
pnpm --filter mastra-agents start
pnpm --filter openai-agents start
```

## Contributing

Contributions are welcome! Please open issues or pull requests on [GitHub](https://github.com/adrianhdezm/sap-aicore-utils).
