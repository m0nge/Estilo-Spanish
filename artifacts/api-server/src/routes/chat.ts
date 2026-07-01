import { Router } from "express";
import { db, chatMensajesTable, usuariosTable, notificacionesTable, procesosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { SendChatMensajeBody } from "@workspace/api-zod";
import { emailMencion } from "../lib/email";

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
    imagenBase64: chatMensajesTable.imagenBase64,
    fechaMensaje: chatMensajesTable.fechaMensaje,
    leido: chatMensajesTable.leido,
    nombreRemitente: usuariosTable.nombre,
    rolRemitente: usuariosTable.rol,
  })
    .from(chatMensajesTable)
    .leftJoin(usuariosTable, eq(chatMensajesTable.usuarioRemitenteId, usuariosTable.id))
    .where(and(
      eq(chatMensajesTable.idProceso, id),
      eq(chatMensajesTable.etapaOrigen, Math.min(etapaOrigen, etapaDestino)),
      eq(chatMensajesTable.etapaDestino, Math.max(etapaOrigen, etapaDestino))
    ));

  res.json(mensajes);
});

// POST /procesos/:id/chat/:etapaOrigen/:etapaDestino
router.post("/procesos/:id/chat/:etapaOrigen/:etapaDestino", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const etapaOrigen = parseInt(Array.isArray(req.params.etapaOrigen) ? req.params.etapaOrigen[0] : req.params.etapaOrigen, 10);
  const etapaDestino = parseInt(Array.isArray(req.params.etapaDestino) ? req.params.etapaDestino[0] : req.params.etapaDestino, 10);

  const parsed = SendChatMensajeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const contenido = parsed.data.contenido ?? "";
  const imagenBase64 = parsed.data.imagenBase64 ?? null;

  // Validar que venga texto o imagen
  if (!contenido.trim() && !imagenBase64) {
    res.status(400).json({ error: "Debe enviar texto o imagen" });
    return;
  }

  const [mensaje] = await db.insert(chatMensajesTable).values({
    idProceso: id,
    etapaOrigen: Math.min(etapaOrigen, etapaDestino),
    etapaDestino: Math.max(etapaOrigen, etapaDestino),
    usuarioRemitenteId: req.usuario!.id,
    contenido,
    imagenBase64,
    leido: false,
  }).returning();

  const [remitente] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, req.usuario!.id));

  // Detectar @menciones en el contenido
  if (contenido) {
    const todosusuarios = await db.select().from(usuariosTable).where(eq(usuariosTable.activo, true));
    const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));

    for (const u of todosusuarios) {
      if (u.id === req.usuario!.id) continue;
      // Buscar @nombre (insensible a mayúsculas/acentos)
      const nombreNorm = u.nombre.toLowerCase().replace(/\s+/g, "");
      const contenidoNorm = contenido.toLowerCase().replace(/\s+/g, "");
      const primerNombre = u.nombre.split(" ")[0]?.toLowerCase() ?? "";

      if (
        contenido.toLowerCase().includes(`@${primerNombre}`) ||
        contenidoNorm.includes(`@${nombreNorm}`)
      ) {
        // Crear notificación en plataforma
        await db.insert(notificacionesTable).values({
          usuarioDestinoId: u.id,
          idProceso: id,
          tipo: "etapa_lista",
          titulo: `💬 Te mencionaron — Orden ${proceso?.numeroPreoferta ?? `#${id}`}`,
          mensaje: `${remitente?.nombre ?? "Alguien"} te mencionó en la orden ${proceso?.numeroPreoferta ?? `#${id}`}: "${contenido.slice(0, 100)}"`,
          leido: false,
        }).catch(() => {});

        // Enviar email si tiene correo
        if (u.email && proceso) {
          emailMencion({
            mencionadoPor: remitente?.nombre ?? "Un colega",
            procesoPreoferta: proceso.numeroPreoferta,
            procesoId: id,
            mensaje: contenido,
            destinatarioEmail: u.email,
          }).catch(() => {});
        }
      }
    }
  }

  res.status(201).json({
    ...mensaje,
    nombreRemitente: remitente?.nombre ?? "",
    rolRemitente: remitente?.rol ?? "",
  });
});

export default router;
