---
name: Red Intelfon component architecture
description: Shared components, new DB columns, and key architectural decisions for the Intelfon workflow app.
---

## Shared Components (artifacts/intelfon/src/components/)
- **ChatBox.tsx** — Reusable chat UI with text + photo upload (base64). Used in both tracking/[id] and etapa/[idProceso]/[numeroEtapa]. Props: mensajes, usuarioId, isPending, onSend(contenido, imagenBase64?), placeholder, maxHeight.
- **Cronometro.tsx** — Animated live timer that counts elapsed time vs SLA. Shows semáforo colors (green/amber/red). Props: fechaInicio, slaHoras, label, compact.
- **TrackingWidget.tsx** — Dashboard widget with process selector + animated "radio" rail showing phases with pulsing active node.

## DB Schema additions
- `chat_mensajes.imagen_base64` (text, nullable) — added for photo support in chat. Pushed via drizzle push-force.

## SLA job
- `artifacts/api-server/src/jobs/slaChecker.ts` — runs every 10min, uses in-memory Sets to avoid duplicate notifications per process/etapa. Threshold: 20% remaining triggers "proximo" alert.

## Key decisions
- Chat images stored as base64 data URIs in DB (no external file storage needed, max 5MB enforced on frontend).
- UpdateUsuarioBody already includes email field in zod schema; admin route does set(parsed.data) so email edits work without backend changes.
- Semáforo colors: green = SLA >20% remaining, amber = <20% remaining, red = vencido.

**Why:** Base64 avoids needing object storage setup for a small-team internal app; the 5MB cap keeps DB rows reasonable.
