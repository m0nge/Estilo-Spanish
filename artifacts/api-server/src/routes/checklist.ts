import { Router } from "express";
import { db, checklistItemsTable, etapasProcesoTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { ToggleChecklistItemBody } from "@workspace/api-zod";

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

  res.json(updated);
});

export default router;
