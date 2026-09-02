# Grok sell-out briefing API

`POST /api/grok-sellout` — Vercel serverless function.

## Auth

Same gate as other admin APIs (`requirePlatformAdmin`):

- Founder email in `x-admin-email`
- Optional `x-admin-secret` / `PLATFORM_ADMIN_SECRET`
- Or a platform-admin Supabase Bearer session

## Secrets (Vercel project, not `VITE_`)

```
XAI_API_KEY=
XAI_MODEL=grok-4-1-fast-reasoning
```

Get a key at https://console.x.ai — never put it in the browser bundle.

## Behaviour

- Reads `apps/web/src/data/sellout-mounjaro.json` (aggregates only).
- Calls `https://api.x.ai/v1/chat/completions` with a JSON schema briefing.
- If the key is missing, returns a deterministic local briefing so the dashboard still works.
- `GET /api/grok-sellout` reports whether the key is configured (no model call).

Do not send the raw Excel or customer names to xAI.
