# Red Intelfon — Workflow Activaciones

Sistema de seguimiento de activaciones de clientes en 5 fases, con checklist por etapa, temporizadores SLA, chat inter-etapas y panel de administración.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080, routed at `/api`)
- `pnpm --filter @workspace/intelfon run dev` — Frontend Vite dev server (port from `$PORT`, routed at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 at `artifacts/api-server` (port 8080)
- Frontend: React + Vite + Tailwind + shadcn/ui at `artifacts/intelfon`
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Auth: JWT via `SESSION_SECRET`, bcryptjs passwords
- API codegen: Orval → `lib/api-client-react` (React Query hooks + Zod schemas)

## Where things live

- **DB schema**: `lib/db/src/schema.ts`
- **OpenAPI spec**: `lib/api-spec/openapi.yaml`
- **API routes**: `artifacts/api-server/src/routes/index.ts`
- **Generated client**: `lib/api-client-react/src/generated/api.ts` + `api.schemas.ts`
- **Frontend pages**: `artifacts/intelfon/src/pages/`
- **Seed data**: `artifacts/api-server/src/seed.ts`

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval generates camelCase React Query hooks; backend returns camelCase (Drizzle ORM).
- JWT stored in `localStorage` as `intelfon_token`; `custom-fetch.ts` injects it automatically.
- SLA timer values (`minutosRestantes`) are in **minutes**, not hours — divide by 60 for display.
- `estadoActual` values: `en_espera`, `en_fase_1`–`en_fase_5`, `completado` (snake_case enums).
- Admin routes protected by `requireAdmin` middleware; user routes by `requireAuth`.

## Product

5-phase client activation tracking:
1. Documentación y Digitalización (Ventas/Activaciones)
2. STR y Despacho (Activaciones/Bodega)
3. Configuración de Dispositivos (Activaciones/MSO)
4. Armado y Configuración Física (Bodega/Activaciones)
5. Entrega y Capacitación (Activaciones/Logística)

Features: checklist por etapa, SLA timers, chat general + chat por etapa, justificación de retrasos, panel admin (usuarios, etapas, SLA, reportes).

## Seed users (password: `intelfon2024`)

| Email | Rol | Área |
|-------|-----|------|
| admin@intelfon.com | Admin | Sistemas |
| ventas@intelfon.com | Ventas | Ventas |
| activaciones@intelfon.com | Activaciones | Activaciones |
| bodega@intelfon.com | Bodega | Bodega |
| mso@intelfon.com | MSO | MSO |
| logistica@intelfon.com | Logistica | Logistica |

## User preferences

- Idioma: Español (todo el UI y mensajes en español)
- Color scheme: rojo (#DC2626), gris oscuro, gris claro, blanco
- Logo: `attached_assets/image_1782498618865.png`

## Gotchas

- `minutosRestantes` in `EtapaDetalle`/`EtapaProceso` is in **minutes** — always divide by 60 before displaying hours.
- `useGetChatMensajes(id, etapaOrigen, etapaDestino)` — general process chat uses `(id, 0, 0)`; etapa-specific chat uses `(id, etapaNum, etapaNum)`.
- `ProcesoInput` requires `planSolicitado` (mandatory field — backend will reject without it).
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
