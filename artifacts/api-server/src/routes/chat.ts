import { Router } from "express";
import { db, chatMensajesTable, usuariosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { SendChatMensajeBody } from "@workspace/api-zod";

const router = Router();

// GET /procesos/:id/chat/:etapaOrigen/:etapaDestino
router.get("/procesos/:id/chat/:etapaOrigen/:etapaDestino", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const etapaOrigen = parseInt(Array.isArray(req.params.etapaOrigen) ? req.params.etapaOrigen[0] : req.params.etapaOrigen, 10);
  const etapaDestino = parseInt(Array.isArray(req.params.etapaDestino) ? req.params.etapaDestino[0] : req.params.etapaDestino, 10);

  const mensajes = await db.select({
    id: chatMensajesTable.id,
    idProceso: chatMensajesTable.idProceso,
    etapaOrigen: chatMensajesTable.etapaOrigen,
    etapaDestino: chatMensajesTable.etapaDestino,
    usuarioRemitenteId: chatMensajesTable.usuarioRemitenteId,
    contenido: chatMensajesTable.contenido,
    fechaMensaje: chatMensajesTable.fechaMensaje,
    leido: chatMensajesTable.leido,
    nombreRemitente: usuariosTable.nombre,
    rolRemitente: usuariosTable.rol,
  })
    .from(chatMensajesTable)
    .leftJoin(usuariosTable, eq(chatMensajesTable.usuarioRemitenteId, usuariosTable.id))
    .where(
      and(
        eq(chatMensajesTable.idProceso, id),
        eq(chatMensajesTable.etapaOrigen, Math.min(etapaOrigen, etapaDestino)),
        eq(chatMensajesTable.etapaDestino, Math.max(etapaOrigen, etapaDestino))
      )
    );

  res.json(mensajes);
});

// POST /procesos/:id/chat/:etapaOrigen/:etapaDestino
router.post("/procesos/:id/chat/:etapaOrigen/:etapaDestino", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const etapaOrigen = parseInt(Array.isArray(req.params.etapaOrigen) ? req.params.etapaOrigen[0] : req.params.etapaOrigen, 10);
  const etapaDestino = parseInt(Array.isArray(req.params.etapaDestino) ? req.params.etapaDestino[0] : req.params.etapaDestino, 10);

  const parsed = SendChatMensajeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [mensaje] = await db.insert(chatMensajesTable).values({
    idProceso: id,
    etapaOrigen: Math.min(etapaOrigen, etapaDestino),
    etapaDestino: Math.max(etapaOrigen, etapaDestino),
    usuarioRemitenteId: req.usuario!.id,
    contenido: parsed.data.contenido,
    leido: false,
  }).returning();

  const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, req.usuario!.id));

  res.status(201).json({
    ...mensaje,
    nombreRemitente: usuario?.nombre ?? "",
    rolRemitente: usuario?.rol ?? "",
  });
});

export default router;
