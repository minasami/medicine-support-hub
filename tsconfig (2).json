# ChronicMed — Chronic Medicines Support Platform

A bilingual (English/Arabic) chronic medicines request and pharmacy management web app.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/chronic-medicines run dev` — run the frontend (port 25867)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + Wouter routing
- API: Express 5 on `/api`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/db/src/schema/` — DB schemas: `medicines.ts`, `requests.ts`, `activity.ts`
- `artifacts/api-server/src/routes/` — Express routes: medicines, requests, dashboard, ai, uploads
- `artifacts/chronic-medicines/src/` — React frontend
  - `pages/` — landing, request, dashboard, request-detail, clinical-assistant, not-found
  - `lib/i18n.tsx` — Language context and `t()` helper for EN/AR
  - `components/layout.tsx` — Shared nav layout with language toggle

## Architecture decisions

- Contract-first: OpenAPI spec → Orval codegen → typed hooks + Zod schemas used on both sides
- Bilingual at the component level: `useLanguage()` + `t(en, ar)` throughout; RTL toggled via `dir` attribute
- Prescription images stored as files in `artifacts/api-server/uploads/` and served at `/api/uploads/:filename`
- OCR and Clinical Support AI are wired to optionally use OpenAI (when `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` are set) with safe fallbacks when not configured
- Activity log table records every status transition for the recent activity feed

## Product

- **Landing page** — Bilingual hero with Request Medicines CTA and Reviewer Dashboard link
- **Request form** — Requester info, for-self/relative toggle, searchable medicine rows (auto-expand), prescription upload + OCR extraction, submit
- **Reviewer Dashboard** — Stats cards, status tabs (All/Pending/Approved/Preparing/Ready/Delivered/Closed), recent activity feed, request list
- **Request Detail** — Full patient info, status progression workflow, reviewer notes, prescription preview
- **Clinical Support Assistant** — Chat interface with prominent bilingual disclaimer banner (non-final decision support only)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `FormLabel` must be inside a `FormField` context (shadcn/ui constraint) — use plain `<label>` inside dynamic field array rows
- `FormControl` inside a Popover trigger inside a field array also breaks — use plain Button instead
- After any OpenAPI spec change, run codegen before anything else
- DB `medicines` table seeded with 30+ common chronic disease medicines (bilingual EN/AR)
- Prescription upload uses base64 in the upload endpoint; the URL stored in DB is `/api/uploads/<filename>`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
