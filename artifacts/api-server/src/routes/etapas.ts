import { Router } from "express";
import { db, etapasProcesoTable, checklistItemsTable, procesosTable, notificacionesTable, usuariosTable, configuracionEtapasTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { JustificarEtapaBody } from "@workspace/api-zod";
import { NOMBRES_ETAPAS, calcularSlaVencido, calcularMinutosRestantes } from "./procesos";
import { emailEtapaLista } from "../lib/email";

const router = Router();

function generateCodigo(prefix: string): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const num = String(Math.floor(Math.random() * 99999) + 1).padStart(5, "0");
  return `${prefix}-${year}-${month}-${num}`;
}

async function getAreasEtapa(numeroEtapa: number): Promise<string[]> {
  const [config] = await db.select().from(configuracionEtapasTable).where(eq(configuracionEtapasTable.numeroEtapa, numeroEtapa));
  return (config?.areasInvolucradas as string[]) ?? [];
}

// GET /procesos/:id/etapas
router.get("/procesos/:id/etapas", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const etapas = await db.select().from(etapasProcesoTable)
    .where(eq(etapasProcesoTable.idProceso, id))
    .orderBy(etapasProcesoTable.numeroEtapa);

  const result = etapas.map(e => ({
    ...e,
    nombreEtapa: NOMBRES_ETAPAS[e.numeroEtapa],
    slaVencido: e.fechaInicio ? calcularSlaVencido(e.fechaInicio, e.slaEtapaHoras) : false,
    minutosRestantes: e.fechaInicio ? calcularMinutosRestantes(e.fechaInicio, e.slaEtapaHoras) : null,
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
  const [config] = await db.select().from(configuracionEtapasTable).where(eq(configuracionEtapasTable.numeroEtapa, numeroEtapa));

  res.json({
    ...etapa,
    nombreEtapa: NOMBRES_ETAPAS[numeroEtapa],
    descripcionEtapa: config?.descripcion ?? null,
    areasInvolucradas: (config?.areasInvolucradas as string[]) ?? [],
    slaVencido: etapa.fechaInicio ? calcularSlaVencido(etapa.fechaInicio, etapa.slaEtapaHoras) : false,
    minutosRestantes: etapa.fechaInicio ? calcularMinutosRestantes(etapa.fechaInicio, etapa.slaEtapaHoras) : null,
    checklist,
    proceso: proceso ? { ...proceso, etapaActual: numeroEtapa, slaVencido: calcularSlaVencido(proceso.fechaInicio, proceso.slaGlobalHoras) } : null,
  });
});

// POST /procesos/:id/etapas/:numeroEtapa/completar
router.post("/procesos/:id/etapas/:numeroEtapa/completar", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const numeroEtapa = parseInt(Array.isArray(req.params.numeroEtapa) ? req.params.numeroEtapa[0] : req.params.numeroEtapa, 10);

  const [etapa] = await db.select().from(etapasProcesoTable)
    .where(and(eq(etapasProcesoTable.idProceso, id), eq(etapasProcesoTable.numeroEtapa, numeroEtapa)));

  if (!etapa) { res.status(404).json({ error: "Etapa no encontrada" }); return; }

  // Verificar checklist
  const items = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.idEtapaProceso, etapa.id));
  const allCompleted = items.length === 0 || items.every(i => i.completado);

  if (!allCompleted) {
    res.status(400).json({ error: "Debe completar todos los items del checklist antes de avanzar" });
    return;
  }

  // Marcar etapa como completada
  const [updated] = await db.update(etapasProcesoTable)
    .set({ estado: "completada", fechaFin: new Date(), checklistCompletado: true, completadoPorId: req.usuario!.id })
    .where(eq(etapasProcesoTable.id, etapa.id))
    .returning();

  // Generar códigos automáticos
  if (numeroEtapa === 2) {
    await db.update(procesosTable).set({ codigoStr: generateCodigo("STR") }).where(eq(procesosTable.id, id));
  } else if (numeroEtapa === 3) {
    await db.update(procesosTable).set({ codigoB800: generateCodigo("B800") }).where(eq(procesosTable.id, id));
  } else if (numeroEtapa === 5) {
    await db.update(procesosTable).set({ codigoR800: generateCodigo("R800"), estadoActual: "completado", fechaFinReal: new Date() }).where(eq(procesosTable.id, id));
  }

  // Activar siguiente etapa
  if (numeroEtapa < 5) {
    const siguienteEtapa = numeroEtapa + 1;
    await db.update(etapasProcesoTable)
      .set({ estado: "activa", fechaInicio: new Date() })
      .where(and(eq(etapasProcesoTable.idProceso, id), eq(etapasProcesoTable.numeroEtapa, siguienteEtapa)));

    await db.update(procesosTable)
      .set({ estadoActual: `en_fase_${siguienteEtapa}` as any })
      .where(eq(procesosTable.id, id));

    // Notificar a usuarios de la siguiente etapa
    const areas = await getAreasEtapa(siguienteEtapa);
    const usuarios = await db.select().from(usuariosTable).where(eq(usuariosTable.activo, true));
    const destinatarios = usuarios.filter(u => areas.includes(u.rol));

    const [procesoParaNotif] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
    for (const dest of destinatarios) {
      await db.insert(notificacionesTable).values({
        usuarioDestinoId: dest.id,
        idProceso: id,
        tipo: "etapa_lista",
        titulo: `🔔 Fase ${siguienteEtapa} lista — Orden ${procesoParaNotif?.numeroPreoferta ?? `#${id}`}`,
        mensaje: `La etapa "${NOMBRES_ETAPAS[siguienteEtapa]}" del proceso de ${procesoParaNotif?.clienteNombre ?? "un cliente"} (${procesoParaNotif?.numeroPreoferta ?? `#${id}`}) está lista para que continúes tu fase.`,
        leido: false,
      });
    }

    // Enviar emails a los destinatarios de la siguiente etapa
    const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
    const destinatariosEmail = destinatarios.filter(d => d.email);
    if (destinatariosEmail.length > 0 && proceso) {
      emailEtapaLista({
        numeroEtapa: siguienteEtapa,
        nombreEtapa: NOMBRES_ETAPAS[siguienteEtapa],
        etapaAnterior: NOMBRES_ETAPAS[numeroEtapa],
        numeroPreoferta: proceso.numeroPreoferta ?? `#${id}`,
        clienteNombre: proceso.clienteNombre,
        procesoId: id,
        destinatarios: destinatariosEmail.map(d => ({ nombre: d.nombre, email: d.email })),
      }).catch(() => {}); // No bloquear la respuesta si el email falla
    }
  } else if (numeroEtapa === 5) {
    // Proceso completado — notificar al creador si existe
    const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
    if (proceso?.usuarioCreadorId) {
      await db.insert(notificacionesTable).values({
        usuarioDestinoId: proceso.usuarioCreadorId,
        idProceso: id,
        tipo: "etapa_lista",
        titulo: `✅ Proceso ${proceso.numeroPreoferta ?? `#${id}`} completado`,
        mensaje: `El proceso de activación de ${proceso.clienteNombre} ha completado todas las fases exitosamente.`,
        leido: false,
      });
    }
  }

  res.json({
    ...updated,
    nombreEtapa: NOMBRES_ETAPAS[numeroEtapa],
    slaVencido: updated.fechaInicio ? calcularSlaVencido(updated.fechaInicio, updated.slaEtapaHoras) : false,
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

  res.json({
    ...updated,
    nombreEtapa: NOMBRES_ETAPAS[numeroEtapa],
    slaVencido: updated.fechaInicio ? calcularSlaVencido(updated.fechaInicio, updated.slaEtapaHoras) : false,
    minutosRestantes: updated.fechaInicio ? calcularMinutosRestantes(updated.fechaInicio, updated.slaEtapaHoras) : null,
  });
});

export default router;
