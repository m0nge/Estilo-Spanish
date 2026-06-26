---
name: Red Intelfon API conventions
description: Non-obvious API quirks for the Intelfon workflow system that are not derivable from reading code
---

## SLA timer is in minutes, not hours

`EtapaDetalle.minutosRestantes` and `EtapaProceso.minutosRestantes` return values in **minutes**. Always divide by 60 for display. Negative means overdue.

**Why:** Backend stores and returns raw minutes; the field name makes it clear, but easy to confuse with `slaEtapaHoras` (which IS in hours).

**How to apply:** Anywhere you show time remaining: `Math.abs(Math.round(minutosRestantes / 60))` hours.

## estadoActual enum values

`ProcesoEstadoActual` uses snake_case: `en_espera`, `en_fase_1` through `en_fase_5`, `completado`. These are NOT human-readable — always map to display labels in the UI.

**Why:** Backend enums predate the frontend and use the internal DB values directly.

## Chat endpoint requires three route params

`useGetChatMensajes(id, etapaOrigen, etapaDestino)` — the chat URL is `/api/procesos/:id/chat/:etapaOrigen/:etapaDestino`.
- General process chat: use `(id, 0, 0)`
- Etapa-specific chat: use `(id, etapaNum, etapaNum)`

**Why:** Chat was designed for inter-stage messaging; 0/0 is the convention for general process chat.

## planSolicitado is required in ProcesoInput

The backend `POST /api/procesos` requires `planSolicitado` or it returns a validation error. This is not obvious from the UI flow.

**Why:** It's part of the commercial pre-offer record.

## JWT stored as intelfon_token

`custom-fetch.ts` reads `localStorage.getItem("intelfon_token")` for auth. The `AuthContext` writes it there on login and clears it on logout.
