import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usuariosTable, configuracionEtapasTable, configuracionSlaTable, etapasProcesoTable, procesosTable, notificacionesTable, bitacoraEntradasTable, checklistItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middlewares/auth";
import { CreateUsuarioBody, UpdateUsuarioBody } from "@workspace/api-zod";
import { calcularSlaVencidoLaboral } from "../lib/businessHours";
import { emailEtapaLista } from "../lib/email";

const NOMBRES_ETAPAS: Record<number, string> = {
  1: "Documentación y Digitalización",
  2: "STR y Despacho",
  3: "Configuración de Dispositivos",
  4: "Armado y Configuración Física",
  5: "Entrega y Capacitación",
};

const router = Router();

// ───────── USUARIOS ─────────
router.get("/admin/usuarios", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const usuarios = await db.select({
    id: usuariosTable.id,
    nombre: usuariosTable.nombre,
    email: usuariosTable.email,
    rol: usuariosTable.rol,
    area: usuariosTable.area,
    activo: usuariosTable.activo,
    fechaCreacion: usuariosTable.fechaCreacion,
  }).from(usuariosTable);
  res.json(usuarios);
});

router.post("/admin/usuarios", requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateUsuarioBody.safeParse(_req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [usuario] = await db.insert(usuariosTable).values({
    nombre: parsed.data.nombre,
    email: parsed.data.email,
    passwordHash,
    rol: parsed.data.rol as any,
    area: parsed.data.area,
    activo: true,
  }).returning();
  res.status(201).json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, area: usuario.area, activo: usuario.activo, fechaCreacion: usuario.fechaCreacion });
});

router.put("/admin/usuarios/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateUsuarioBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [updated] = await db.update(usuariosTable).set(parsed.data as any).where(eq(usuariosTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
  res.json({ id: updated.id, nombre: updated.nombre, email: updated.email, rol: updated.rol, area: updated.area, activo: updated.activo, fechaCreacion: updated.fechaCreacion });
});

router.delete("/admin/usuarios/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(usuariosTable).set({ activo: false }).where(eq(usuariosTable.id, id));
  res.sendStatus(204);
});

// ───────── ETAPAS CONFIG ─────────
router.get("/admin/etapas", requireAuth, async (_req, res): Promise<void> => {
  const configs = await db.select().from(configuracionEtapasTable).orderBy(configuracionEtapasTable.ordenVisualizacion);
  res.json(configs);
});

router.post("/admin/etapas", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { nombreEtapa, descripcion, slaHoras, areasInvolucradas, checklistTemplate, color } = req.body;
  if (!nombreEtapa) { res.status(400).json({ error: "nombreEtapa requerido" }); return; }

  const existentes = await db.select().from(configuracionEtapasTable).orderBy(configuracionEtapasTable.numeroEtapa);
  const maxNumero = existentes.length > 0 ? Math.max(...existentes.map(e => e.numeroEtapa)) : 0;
  const maxOrden = existentes.length > 0 ? Math.max(...existentes.map(e => e.ordenVisualizacion)) : 0;

  const [nueva] = await db.insert(configuracionEtapasTable).values({
    numeroEtapa: maxNumero + 1,
    nombreEtapa,
    descripcion: descripcion ?? null,
    slaHoras: slaHoras ?? 24,
    areasInvolucradas: areasInvolucradas ?? [],
    checklistTemplate: checklistTemplate ?? [],
    color: color ?? "#DC2626",
    activa: true,
    ordenVisualizacion: maxOrden + 1,
  }).returning();

  res.status(201).json(nueva);
});

router.put("/admin/etapas/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { nombreEtapa, descripcion, slaHoras, areasInvolucradas, checklistTemplate, color, activa, ordenVisualizacion } = req.body;

  const updateData: Record<string, unknown> = {};
  if (nombreEtapa != null) updateData.nombreEtapa = nombreEtapa;
  if (descripcion != null) updateData.descripcion = descripcion;
  if (slaHoras != null) updateData.slaHoras = slaHoras;
  if (areasInvolucradas != null) updateData.areasInvolucradas = areasInvolucradas;
  if (checklistTemplate != null) updateData.checklistTemplate = checklistTemplate;
  if (color != null) updateData.color = color;
  if (activa != null) updateData.activa = activa;
  if (ordenVisualizacion != null) updateData.ordenVisualizacion = ordenVisualizacion;

  const [updated] = await db.update(configuracionEtapasTable).set(updateData as any).where(eq(configuracionEtapasTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Etapa no encontrada" }); return; }
  res.json(updated);
});

router.delete("/admin/etapas/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(configuracionEtapasTable).set({ activa: false }).where(eq(configuracionEtapasTable.id, id));
  res.sendStatus(204);
});

// Reordenar etapas: recibe array de {id, ordenVisualizacion}
router.put("/admin/etapas-orden", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const orden: { id: number; ordenVisualizacion: number }[] = req.body;
  if (!Array.isArray(orden)) { res.status(400).json({ error: "Se esperaba un array" }); return; }
  for (const item of orden) {
    await db.update(configuracionEtapasTable).set({ ordenVisualizacion: item.ordenVisualizacion }).where(eq(configuracionEtapasTable.id, item.id));
  }
  res.json({ ok: true });
});

// ───────── SLA CONFIG ─────────
router.get("/admin/sla-config", requireAuth, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(configuracionSlaTable).where(eq(configuracionSlaTable.activo, true));
  if (!config) { res.status(404).json({ error: "Configuración no encontrada" }); return; }
  res.json(config);
});

router.put("/admin/sla-config", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { alertaPorcentaje } = req.body;
  const [existing] = await db.select().from(configuracionSlaTable).where(eq(configuracionSlaTable.activo, true));
  if (!existing) { res.status(404).json({ error: "Configuración no encontrada" }); return; }
  const [updated] = await db.update(configuracionSlaTable).set({ alertaPorcentaje }).where(eq(configuracionSlaTable.id, existing.id)).returning();
  res.json(updated);
});

// ───────── REPORTES ─────────
router.get("/admin/reportes/sla", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const procesos = await db.select().from(procesosTable);
  const etapas = await db.select().from(etapasProcesoTable);
  const configs = await db.select().from(configuracionEtapasTable).orderBy(configuracionEtapasTable.numeroEtapa);

  const cumplimientoPorEtapa = configs.map(cfg => {
    const etapasFase = etapas.filter(e => e.numeroEtapa === cfg.numeroEtapa && e.estado === "completada");
    const cumplidas = etapasFase.filter(e => e.fechaInicio && !calcularSlaVencidoLaboral(e.fechaInicio, e.slaEtapaHoras)).length;
    const vencidas = etapasFase.length - cumplidas;
    return {
      etapa: cfg.numeroEtapa,
      nombre: cfg.nombreEtapa,
      color: cfg.color,
      cumplidos: cumplidas,
      vencidos: vencidas,
      porcentajeCumplimiento: etapasFase.length > 0 ? Math.round((cumplidas / etapasFase.length) * 100) : 100,
    };
  });

  const procesosEnRiesgo = procesos
    .filter(p => p.estadoActual !== "completado")
    .map(p => {
      const etapaActiva = etapas.find(e => e.idProceso === p.id && e.estado === "activa");
      const vencido = etapaActiva?.fechaInicio ? calcularSlaVencidoLaboral(etapaActiva.fechaInicio, etapaActiva.slaEtapaHoras) : false;
      return { ...p, etapaActual: etapaActiva?.numeroEtapa ?? null, slaVencido: vencido };
    })
    .filter(p => p.slaVencido);

  res.json({
    cumplimientoPorEtapa,
    promedioTiempoPorEtapa: cumplimientoPorEtapa,
    procesosEnRiesgo,
    totalCompletados: procesos.filter(p => p.estadoActual === "completado").length,
    totalEnProgreso: procesos.filter(p => p.estadoActual !== "completado").length,
    totalVencidos: procesosEnRiesgo.length,
  });
});

router.get("/admin/reportes/procesos", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const procesos = await db.select().from(procesosTable);
  const etapas = await db.select().from(etapasProcesoTable);
  const result = procesos.map(p => {
    const etapaActiva = etapas.find(e => e.idProceso === p.id && e.estado === "activa");
    const horasTranscurridas = (Date.now() - p.fechaInicio.getTime()) / 3600000;
    const slaVencido = etapaActiva?.fechaInicio ? calcularSlaVencidoLaboral(etapaActiva.fechaInicio, etapaActiva.slaEtapaHoras) : false;
    return { ...p, etapaActual: etapaActiva?.numeroEtapa ?? null, slaVencido, horasTranscurridas: Math.round(horasTranscurridas * 10) / 10 };
  });
  res.json(result);
});

// ───────── BITÁCORA ─────────
router.post("/bitacora", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { procesoId, etapaProcesoId, checklistItemId, contactoNombre, contactoTelefono, comentario } = req.body;
  if (!procesoId || !comentario) { res.status(400).json({ error: "procesoId y comentario son requeridos" }); return; }
  const [entry] = await db.insert(bitacoraEntradasTable).values({
    procesoId,
    etapaProcesoId: etapaProcesoId ?? null,
    checklistItemId: checklistItemId ?? null,
    autorId: req.usuario!.id,
    contactoNombre: contactoNombre ?? null,
    contactoTelefono: contactoTelefono ?? null,
    comentario,
  }).returning();
  res.status(201).json(entry);
});

router.get("/bitacora/proceso/:procesoId", requireAuth, async (req, res): Promise<void> => {
  const procesoId = parseInt(Array.isArray(req.params.procesoId) ? req.params.procesoId[0] : req.params.procesoId, 10);
  const entries = await db.select({
    id: bitacoraEntradasTable.id,
    procesoId: bitacoraEntradasTable.procesoId,
    etapaProcesoId: bitacoraEntradasTable.etapaProcesoId,
    checklistItemId: bitacoraEntradasTable.checklistItemId,
    autorId: bitacoraEntradasTable.autorId,
    autorNombre: usuariosTable.nombre,
    contactoNombre: bitacoraEntradasTable.contactoNombre,
    contactoTelefono: bitacoraEntradasTable.contactoTelefono,
    comentario: bitacoraEntradasTable.comentario,
    creadoEn: bitacoraEntradasTable.creadoEn,
  })
    .from(bitacoraEntradasTable)
    .leftJoin(usuariosTable, eq(bitacoraEntradasTable.autorId, usuariosTable.id))
    .where(eq(bitacoraEntradasTable.procesoId, procesoId))
    .orderBy(bitacoraEntradasTable.creadoEn);
  res.json(entries);
});

router.get("/bitacora/etapa/:etapaId", requireAuth, async (req, res): Promise<void> => {
  const etapaId = parseInt(Array.isArray(req.params.etapaId) ? req.params.etapaId[0] : req.params.etapaId, 10);
  const entries = await db.select({
    id: bitacoraEntradasTable.id,
    procesoId: bitacoraEntradasTable.procesoId,
    etapaProcesoId: bitacoraEntradasTable.etapaProcesoId,
    checklistItemId: bitacoraEntradasTable.checklistItemId,
    autorId: bitacoraEntradasTable.autorId,
    autorNombre: usuariosTable.nombre,
    contactoNombre: bitacoraEntradasTable.contactoNombre,
    contactoTelefono: bitacoraEntradasTable.contactoTelefono,
    comentario: bitacoraEntradasTable.comentario,
    creadoEn: bitacoraEntradasTable.creadoEn,
  })
    .from(bitacoraEntradasTable)
    .leftJoin(usuariosTable, eq(bitacoraEntradasTable.autorId, usuariosTable.id))
    .where(eq(bitacoraEntradasTable.etapaProcesoId, etapaId))
    .orderBy(bitacoraEntradasTable.creadoEn);
  res.json(entries);
});

// ───────── PENDIENTES POR ÁREA ─────────
router.get("/pendientes-area", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const area = req.usuario!.rol;
  const items = await db.select({
    id: checklistItemsTable.id,
    descripcion: checklistItemsTable.descripcion,
    areaResponsable: checklistItemsTable.areaResponsable,
    completado: checklistItemsTable.completado,
    idEtapaProceso: checklistItemsTable.idEtapaProceso,
    etapaNumero: etapasProcesoTable.numeroEtapa,
    idProceso: etapasProcesoTable.idProceso,
    numeroPreoferta: procesosTable.numeroPreoferta,
    clienteNombre: procesosTable.clienteNombre,
  })
    .from(checklistItemsTable)
    .leftJoin(etapasProcesoTable, eq(checklistItemsTable.idEtapaProceso, etapasProcesoTable.id))
    .leftJoin(procesosTable, eq(etapasProcesoTable.idProceso, procesosTable.id))
    .where(and(eq(checklistItemsTable.completado, false), eq(etapasProcesoTable.estado, "activa")));

  // Filtrar por área del usuario
  const filtrados = items.filter(i => !i.areaResponsable || i.areaResponsable.includes(area));
  res.json(filtrados);
});

export default router;
