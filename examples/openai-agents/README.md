# OpenAI Agents SDK Example

Shows how to run an `@openai/agents` agent backed by the SAP AI Core Provider.

## Prerequisites

1. Node.js 24+ (see `.node-version`).
2. `pnpm` installed.

## Configure

Copy `.env.example` to `.env` and fill in your SAP AI Core credentials:

```bash
cp .env.example .env
```

## Run

```bash
pnpm --filter openai-agents start
```

You should see `Output:` followed by a short response from the agent in `src/index.ts`.

## Notes

The example uses `sap-aicore/gpt-4.1`. Ensure this deployment exists in your SAP AI Core account or update the model id.
