import { Router } from "express";
import { db, notificacionesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// GET /notificaciones
router.get("/notificaciones", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const notifs = await db.select().from(notificacionesTable)
    .where(eq(notificacionesTable.usuarioDestinoId, req.usuario!.id))
    .orderBy(notificacionesTable.fechaCreacion)
    .limit(50);

  res.json(notifs.reverse());
});

// PUT /notificaciones/:id/leer
router.put("/notificaciones/:id/leer", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [updated] = await db.update(notificacionesTable)
    .set({ leido: true })
    .where(and(eq(notificacionesTable.id, id), eq(notificacionesTable.usuarioDestinoId, req.usuario!.id)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Notificación no encontrada" }); return; }
  res.json(updated);
});

// PUT /notificaciones/leer-todas
router.put("/notificaciones/leer-todas", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db.update(notificacionesTable)
    .set({ leido: true })
    .where(eq(notificacionesTable.usuarioDestinoId, req.usuario!.id));

  res.json({ success: true });
});

export default router;
