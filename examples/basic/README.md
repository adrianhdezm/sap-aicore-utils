# Basic Example

Minimal `generateText` usage with the SAP AI Core Provider and the Vercel AI SDK.

## Prerequisites

1. Node.js 24+ (see `.node-version`).
2. `pnpm` installed.

## Configure

Copy `.env.example` at the repo root to `.env` and fill in your SAP AI Core credentials:

```bash
cp .env.example .env
```

## Run

```bash
pnpm --filter basic-example start
```

Expected output includes a `Response:` line and token `Usage` for the prompt sent in `src/index.ts`.

## Notes

If you see authentication errors, confirm `AICORE_BASE_URL` and `AICORE_AUTH_URL` match your SAP AI Core tenant endpoints.
