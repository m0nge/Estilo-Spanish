import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usuariosTable, configuracionEtapasTable, configuracionSlaTable, etapasProcesoTable, procesosTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middlewares/auth";
import { CreateUsuarioBody, UpdateUsuarioBody, UpdateConfigEtapaBody, UpdateSlaConfigBody } from "@workspace/api-zod";
import { NOMBRES_ETAPAS, calcularSlaVencido } from "./procesos";

const router = Router();

// GET /admin/usuarios
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

// POST /admin/usuarios
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

  res.status(201).json({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    area: usuario.area,
    activo: usuario.activo,
    fechaCreacion: usuario.fechaCreacion,
  });
});

// PUT /admin/usuarios/:id
router.put("/admin/usuarios/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateUsuarioBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(usuariosTable)
    .set(parsed.data as any)
    .where(eq(usuariosTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Usuario no encontrado" }); return; }

  res.json({
    id: updated.id,
    nombre: updated.nombre,
    email: updated.email,
    rol: updated.rol,
    area: updated.area,
    activo: updated.activo,
    fechaCreacion: updated.fechaCreacion,
  });
});

// DELETE /admin/usuarios/:id
router.delete("/admin/usuarios/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(usuariosTable).set({ activo: false }).where(eq(usuariosTable.id, id));
  res.sendStatus(204);
});

// GET /admin/etapas
router.get("/admin/etapas", requireAuth, async (_req, res): Promise<void> => {
  const configs = await db.select().from(configuracionEtapasTable).orderBy(configuracionEtapasTable.numeroEtapa);
  res.json(configs);
});

// PUT /admin/etapas/:id
router.put("/admin/etapas/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateConfigEtapaBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(configuracionEtapasTable)
    .set(parsed.data as any)
    .where(eq(configuracionEtapasTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Configuración no encontrada" }); return; }
  res.json(updated);
});

// GET /admin/sla-config
router.get("/admin/sla-config", requireAuth, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(configuracionSlaTable).where(eq(configuracionSlaTable.activo, true));
  if (!config) { res.status(404).json({ error: "Configuración no encontrada" }); return; }
  res.json(config);
});

// PUT /admin/sla-config
router.put("/admin/sla-config", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateSlaConfigBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(configuracionSlaTable).where(eq(configuracionSlaTable.activo, true));
  if (!existing) { res.status(404).json({ error: "Configuración no encontrada" }); return; }

  const [updated] = await db.update(configuracionSlaTable)
    .set(parsed.data as any)
    .where(eq(configuracionSlaTable.id, existing.id))
    .returning();

  res.json(updated);
});

// GET /admin/reportes/sla
router.get("/admin/reportes/sla", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const procesos = await db.select().from(procesosTable);
  const etapas = await db.select().from(etapasProcesoTable);

  const cumplimientoPorEtapa = [1, 2, 3, 4, 5].map(fase => {
    const etapasFase = etapas.filter(e => e.numeroEtapa === fase && e.estado === "completada");
    const cumplidas = etapasFase.filter(e => e.fechaInicio && !calcularSlaVencido(e.fechaInicio, e.slaEtapaHoras)).length;
    const vencidas = etapasFase.length - cumplidas;
    return {
      etapa: fase,
      nombre: NOMBRES_ETAPAS[fase],
      cumplidos: cumplidas,
      vencidos: vencidas,
      porcentajeCumplimiento: etapasFase.length > 0 ? Math.round((cumplidas / etapasFase.length) * 100) : 100,
    };
  });

  const promedioTiempoPorEtapa = [1, 2, 3, 4, 5].map(fase => {
    const completadas = etapas.filter(e => e.numeroEtapa === fase && e.estado === "completada" && e.fechaInicio && e.fechaFin);
    const promedio = completadas.length > 0
      ? completadas.reduce((acc, e) => {
          const horas = (e.fechaFin!.getTime() - e.fechaInicio!.getTime()) / 3600000;
          return acc + horas;
        }, 0) / completadas.length
      : 0;
    return { etapa: fase, nombre: NOMBRES_ETAPAS[fase], promedioHoras: Math.round(promedio * 10) / 10 };
  });

  const procesosEnRiesgo = procesos
    .filter(p => p.estadoActual !== "completado" && calcularSlaVencido(p.fechaInicio, p.slaGlobalHoras))
    .map(p => ({ ...p, etapaActual: null, slaVencido: true }));

  res.json({
    cumplimientoPorEtapa,
    promedioTiempoPorEtapa,
    procesosEnRiesgo,
    totalCompletados: procesos.filter(p => p.estadoActual === "completado").length,
    totalEnProgreso: procesos.filter(p => p.estadoActual !== "completado").length,
    totalVencidos: procesosEnRiesgo.length,
  });
});

// GET /admin/reportes/procesos
router.get("/admin/reportes/procesos", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const procesos = await db.select().from(procesosTable);
  const etapas = await db.select().from(etapasProcesoTable);

  const result = procesos.map(p => {
    const etapaActiva = etapas.find(e => e.idProceso === p.id && e.estado === "activa");
    const horasTranscurridas = (Date.now() - p.fechaInicio.getTime()) / 3600000;
    return {
      ...p,
      etapaActual: etapaActiva?.numeroEtapa ?? null,
      slaVencido: calcularSlaVencido(p.fechaInicio, p.slaGlobalHoras),
      horasTranscurridas: Math.round(horasTranscurridas * 10) / 10,
    };
  });

  res.json(result);
});

export default router;
