import { Router } from "express";
import { db, checklistItemsTable, etapasProcesoTable, notificacionesTable, usuariosTable, procesosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { ToggleChecklistItemBody } from "@workspace/api-zod";
import { emailNotificacionChecklistItem } from "../lib/email";

const router = Router();

// GET /etapas/:etapaId/checklist
router.get("/etapas/:etapaId/checklist", requireAuth, async (req, res): Promise<void> => {
  const etapaId = parseInt(Array.isArray(req.params.etapaId) ? req.params.etapaId[0] : req.params.etapaId, 10);
  const items = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.idEtapaProceso, etapaId));
  res.json(items);
});

// PUT /checklist/:itemId/toggle
router.put("/checklist/:itemId/toggle", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const itemId = parseInt(Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId, 10);
  const parsed = ToggleChecklistItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {
    completado: parsed.data.completado,
    fechaCompletado: parsed.data.completado ? new Date() : null,
    usuarioQuienCompletoId: parsed.data.completado ? req.usuario!.id : null,
  };
  if (parsed.data.notas != null) updateData.notas = parsed.data.notas;

  const [updated] = await db.update(checklistItemsTable)
    .set(updateData as any)
    .where(eq(checklistItemsTable.id, itemId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Item no encontrado" }); return; }

  // Actualizar checklistCompletado en etapa
  const items = await db.select().from(checklistItemsTable).where(eq(checklistItemsTable.idEtapaProceso, updated.idEtapaProceso));
  const allCompleted = items.every(i => i.completado);
  await db.update(etapasProcesoTable)
    .set({ checklistCompletado: allCompleted })
    .where(eq(etapasProcesoTable.id, updated.idEtapaProceso));

  // Enviar notificaciones si se completó y hay usuarios configurados
  if (parsed.data.completado && (updated.notificarUsuarioIds as number[] ?? []).length > 0) {
    const idsNotif = updated.notificarUsuarioIds as number[];
    const [etapa] = await db.select().from(etapasProcesoTable).where(eq(etapasProcesoTable.id, updated.idEtapaProceso));
    const [proceso] = etapa ? await db.select().from(procesosTable).where(eq(procesosTable.id, etapa.idProceso)) : [];
    const quienCompleto = req.usuario!;

    for (const uid of idsNotif) {
      await db.insert(notificacionesTable).values({
        usuarioDestinoId: uid,
        idProceso: etapa?.idProceso ?? null,
        tipo: "etapa_lista",
        titulo: `✅ Tarea completada — Orden ${proceso?.numeroPreoferta ?? `#${etapa?.idProceso}`}`,
        mensaje: `"${updated.descripcion}" fue completada por ${quienCompleto.nombre} en la orden ${proceso?.numeroPreoferta ?? ""}.`,
        leido: false,
      });
    }

    // Enviar email
    const destinatarios = await db.select().from(usuariosTable).where(eq(usuariosTable.activo, true));
    const destEmail = destinatarios.filter(u => idsNotif.includes(u.id) && u.email);
    if (destEmail.length > 0 && proceso) {
      emailNotificacionChecklistItem({
        descripcion: updated.descripcion,
        procesoPreoferta: proceso.numeroPreoferta,
        completadoPor: quienCompleto.nombre,
        destinatarios: destEmail.map(d => ({ nombre: d.nombre, email: d.email })),
        procesoId: proceso.id,
      }).catch(() => {});
    }
  }

  res.json(updated);
});

// PUT /checklist/:itemId — actualizar notificarUsuarioIds u otros campos
router.put("/checklist/:itemId", requireAuth, async (req, res): Promise<void> => {
  const itemId = parseInt(Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId, 10);
  const { notificarUsuarioIds } = req.body;
  const updateData: Record<string, unknown> = {};
  if (notificarUsuarioIds != null) updateData.notificarUsuarioIds = notificarUsuarioIds;

  const [updated] = await db.update(checklistItemsTable)
    .set(updateData as any)
    .where(eq(checklistItemsTable.id, itemId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Item no encontrado" }); return; }
  res.json(updated);
});

export default router;
