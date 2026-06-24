# Mastra Agents Example

Mastra agents wired to SAP AI Core through the provider.

## Prerequisites

1. Node.js 24+ (see `.node-version`).
2. `pnpm` installed.

## Configure

Mastra loads `.env` from the example directory, not the repo root. Copy the root `.env.example` here:

```bash
cp ../../.env.example examples/mastra-agents/.env
# then fill in your credentials
```

Or from within the example directory:

```bash
cp ../../.env.example .env
```

## Run

Development mode:

```bash
pnpm --filter mastra-agents dev
```

Production mode:

```bash
pnpm --filter mastra-agents start
```

Mastra Studio is available at `http://localhost:4111`.

## Notes

The default agent uses `sap-aicore/gpt-4o` in `src/mastra/agents/weather-agent.ts`. Update the model id if your deployment name differs.
