import { Router } from "express";
import { db, etapasProcesoTable, checklistItemsTable, procesosTable, notificacionesTable, usuariosTable, configuracionEtapasTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { JustificarEtapaBody } from "@workspace/api-zod";
import { calcularSlaVencidoLaboral, calcularMinutosRestantesLaboral } from "../lib/businessHours";
import { emailEtapaLista } from "../lib/email";

const router = Router();

async function getConfigMap(): Promise<Record<number, { nombre: string; color: string; areas: string[]; descripcion?: string }>> {
  const configs = await db.select().from(configuracionEtapasTable);
  const map: Record<number, { nombre: string; color: string; areas: string[]; descripcion?: string }> = {};
  for (const c of configs) {
    map[c.numeroEtapa] = {
      nombre: c.nombreEtapa,
      color: c.color,
      areas: (c.areasInvolucradas as string[]) ?? [],
      descripcion: c.descripcion ?? undefined,
    };
  }
  return map;
}

// GET /procesos/:id/etapas
router.get("/procesos/:id/etapas", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const etapas = await db.select().from(etapasProcesoTable)
    .where(eq(etapasProcesoTable.idProceso, id))
    .orderBy(etapasProcesoTable.numeroEtapa);
  const configMap = await getConfigMap();
  const result = etapas.map(e => ({
    ...e,
    nombreEtapa: configMap[e.numeroEtapa]?.nombre ?? `Etapa ${e.numeroEtapa}`,
    color: configMap[e.numeroEtapa]?.color ?? "#DC2626",
    slaVencido: e.fechaInicio ? calcularSlaVencidoLaboral(e.fechaInicio, e.slaEtapaHoras) : false,
    minutosRestantes: e.fechaInicio ? calcularMinutosRestantesLaboral(e.fechaInicio, e.slaEtapaHoras) : null,
  }));
  res.json(result);
});

// GET /procesos/:id/etapas/:numeroEtapa
router.get("/procesos/:id/etapas/:numeroEtapa", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const numeroEtapa = parseInt(Array.isArray(req.params.numeroEtapa) ? req.params.numeroEtapa[0] : req.params.numeroEtapa, 10);

  const [etapa] = await db.select().from(etapasProcesoTable)
    .where(and(eq(etapasProcesoTable.idProceso, id), eq(etapasProcesoTable.numeroEtapa, numeroEtapa)));
  if (!etapa) { res.status(404).json({ error: "Etapa no encontrada" }); return; }

  const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
  const checklist = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.idEtapaProceso, etapa.id));
  const configMap = await getConfigMap();
  const cfg = configMap[numeroEtapa];

  res.json({
    ...etapa,
    nombreEtapa: cfg?.nombre ?? `Etapa ${numeroEtapa}`,
    color: cfg?.color ?? "#DC2626",
    descripcionEtapa: cfg?.descripcion ?? null,
    areasInvolucradas: cfg?.areas ?? [],
    slaVencido: etapa.fechaInicio ? calcularSlaVencidoLaboral(etapa.fechaInicio, etapa.slaEtapaHoras) : false,
    minutosRestantes: etapa.fechaInicio ? calcularMinutosRestantesLaboral(etapa.fechaInicio, etapa.slaEtapaHoras) : null,
    checklist,
    proceso: proceso ? { ...proceso, etapaActual: numeroEtapa, slaVencido: etapa.fechaInicio ? calcularSlaVencidoLaboral(etapa.fechaInicio, etapa.slaEtapaHoras) : false } : null,
  });
});

// POST /procesos/:id/etapas/:numeroEtapa/completar
router.post("/procesos/:id/etapas/:numeroEtapa/completar", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const numeroEtapa = parseInt(Array.isArray(req.params.numeroEtapa) ? req.params.numeroEtapa[0] : req.params.numeroEtapa, 10);

  const [etapa] = await db.select().from(etapasProcesoTable)
    .where(and(eq(etapasProcesoTable.idProceso, id), eq(etapasProcesoTable.numeroEtapa, numeroEtapa)));
  if (!etapa) { res.status(404).json({ error: "Etapa no encontrada" }); return; }

  const items = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.idEtapaProceso, etapa.id));
  const allCompleted = items.length === 0 || items.every(i => i.completado);
  if (!allCompleted) {
    res.status(400).json({ error: "Debe completar todos los items del checklist antes de avanzar" });
    return;
  }

  const [updated] = await db.update(etapasProcesoTable)
    .set({ estado: "completada", fechaFin: new Date(), checklistCompletado: true, completadoPorId: req.usuario!.id })
    .where(eq(etapasProcesoTable.id, etapa.id))
    .returning();

  // Generar códigos automáticos (mantener compatibilidad)
  if (numeroEtapa === 2) {
    await db.update(procesosTable).set({ codigoStr: `STR-${Date.now()}` }).where(eq(procesosTable.id, id));
  } else if (numeroEtapa === 3) {
    await db.update(procesosTable).set({ codigoB800: `B800-${Date.now()}` }).where(eq(procesosTable.id, id));
  }

  // Obtener todas las etapas del proceso para determinar siguiente
  const todasEtapas = await db.select().from(etapasProcesoTable)
    .where(eq(etapasProcesoTable.idProceso, id))
    .orderBy(etapasProcesoTable.numeroEtapa);
  const configMap = await getConfigMap();
  const currentIdx = todasEtapas.findIndex(e => e.numeroEtapa === numeroEtapa);
  const siguienteEtapa = todasEtapas[currentIdx + 1];

  if (siguienteEtapa) {
    await db.update(etapasProcesoTable)
      .set({ estado: "activa", fechaInicio: new Date() })
      .where(eq(etapasProcesoTable.id, siguienteEtapa.id));
    await db.update(procesosTable)
      .set({ estadoActual: `en_fase_${siguienteEtapa.numeroEtapa}` as any })
      .where(eq(procesosTable.id, id));

    // Notificar a usuarios de la siguiente etapa
    const areas = configMap[siguienteEtapa.numeroEtapa]?.areas ?? [];
    const nombreSiguiente = configMap[siguienteEtapa.numeroEtapa]?.nombre ?? `Etapa ${siguienteEtapa.numeroEtapa}`;
    const nombreActual = configMap[numeroEtapa]?.nombre ?? `Etapa ${numeroEtapa}`;
    const todos = await db.select().from(usuariosTable).where(eq(usuariosTable.activo, true));
    const destinatarios = todos.filter(u => areas.includes(u.rol));
    const [procesoParaNotif] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));

    for (const dest of destinatarios) {
      await db.insert(notificacionesTable).values({
        usuarioDestinoId: dest.id,
        idProceso: id,
        tipo: "etapa_lista",
        titulo: `🔔 ${nombreSiguiente} lista — Orden ${procesoParaNotif?.numeroPreoferta ?? `#${id}`}`,
        mensaje: `La etapa "${nombreSiguiente}" de la orden ${procesoParaNotif?.numeroPreoferta ?? `#${id}`} está lista para continuar.`,
        leido: false,
      }).catch(() => {});
    }

    const destEmail = destinatarios.filter(d => d.email);
    if (destEmail.length > 0 && procesoParaNotif) {
      emailEtapaLista({
        numeroEtapa: siguienteEtapa.numeroEtapa,
        nombreEtapa: nombreSiguiente,
        etapaAnterior: nombreActual,
        numeroPreoferta: procesoParaNotif.numeroPreoferta ?? `#${id}`,
        clienteNombre: procesoParaNotif.clienteNombre ?? procesoParaNotif.numeroPreoferta,
        procesoId: id,
        destinatarios: destEmail.map(d => ({ nombre: d.nombre, email: d.email })),
      }).catch(() => {});
    }
  } else {
    // Última etapa — proceso completado
    await db.update(procesosTable)
      .set({ estadoActual: "completado", fechaFinReal: new Date(), codigoR800: `R800-${Date.now()}` })
      .where(eq(procesosTable.id, id));

    const [procesoFinal] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
    if (procesoFinal?.usuarioCreadorId) {
      await db.insert(notificacionesTable).values({
        usuarioDestinoId: procesoFinal.usuarioCreadorId,
        idProceso: id,
        tipo: "etapa_lista",
        titulo: `✅ Proceso ${procesoFinal.numeroPreoferta ?? `#${id}`} completado`,
        mensaje: `El proceso de activación ${procesoFinal.numeroPreoferta} ha completado todas las fases exitosamente.`,
        leido: false,
      }).catch(() => {});
    }
  }

  const cfg = configMap[numeroEtapa];
  res.json({
    ...updated,
    nombreEtapa: cfg?.nombre ?? `Etapa ${numeroEtapa}`,
    color: cfg?.color ?? "#DC2626",
    slaVencido: updated.fechaInicio ? calcularSlaVencidoLaboral(updated.fechaInicio, updated.slaEtapaHoras) : false,
    minutosRestantes: null,
  });
});

// POST /procesos/:id/etapas/:numeroEtapa/justificar
router.post("/procesos/:id/etapas/:numeroEtapa/justificar", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const numeroEtapa = parseInt(Array.isArray(req.params.numeroEtapa) ? req.params.numeroEtapa[0] : req.params.numeroEtapa, 10);

  const parsed = JustificarEtapaBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(etapasProcesoTable)
    .set({ justificacionRetraso: parsed.data.justificacion })
    .where(and(eq(etapasProcesoTable.idProceso, id), eq(etapasProcesoTable.numeroEtapa, numeroEtapa)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Etapa no encontrada" }); return; }

  const configMap = await getConfigMap();
  const cfg = configMap[numeroEtapa];

  res.json({
    ...updated,
    nombreEtapa: cfg?.nombre ?? `Etapa ${numeroEtapa}`,
    color: cfg?.color ?? "#DC2626",
    slaVencido: updated.fechaInicio ? calcularSlaVencidoLaboral(updated.fechaInicio, updated.slaEtapaHoras) : false,
    minutosRestantes: updated.fechaInicio ? calcularMinutosRestantesLaboral(updated.fechaInicio, updated.slaEtapaHoras) : null,
  });
});

export default router;
