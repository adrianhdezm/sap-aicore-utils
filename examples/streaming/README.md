# Streaming Example

`streamText` usage with the SAP AI Core Provider and the Vercel AI SDK.

## Prerequisites

1. Node.js 24+ (see `.node-version`).
2. `pnpm` installed.

## Configure

Copy `.env.example` to `.env` and fill in your SAP AI Core credentials:

```bash
cp .env.example .env
```

## Install and build

From the repo root:

```bash
pnpm install
pnpm run build
```

## Run

```bash
pnpm --filter streaming-example start
```

Output streams token-by-token to the console, followed by a `--- Stream completed ---` line.

## Notes

If you see authentication errors, confirm `AICORE_BASE_URL` and `AICORE_AUTH_URL` match your SAP AI Core tenant endpoints.
