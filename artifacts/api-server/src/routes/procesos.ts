import { Router } from "express";
import { db, procesosTable, etapasProcesoTable, checklistItemsTable, configuracionEtapasTable, notificacionesTable } from "@workspace/db";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { ListProcesosQueryParams, UpdateProcesoBody, PriorizarProcesoBody } from "@workspace/api-zod";
import { calcularSlaVencidoLaboral, calcularMinutosRestantesLaboral } from "../lib/businessHours";

const router = Router();

export const NOMBRES_ETAPAS: Record<number, string> = {};

async function getNombresEtapas(): Promise<Record<number, string>> {
  const configs = await db.select().from(configuracionEtapasTable);
  const map: Record<number, string> = {};
  for (const c of configs) map[c.numeroEtapa] = c.nombreEtapa;
  return map;
}

// Exportar para compatibilidad con otros módulos
export function calcularSlaVencido(fechaInicio: Date, slaHoras: number): boolean {
  return calcularSlaVencidoLaboral(fechaInicio, slaHoras);
}

export function calcularMinutosRestantes(fechaInicio: Date, slaHoras: number): number {
  return calcularMinutosRestantesLaboral(fechaInicio, slaHoras);
}

async function crearEtapasParaProceso(idProceso: number): Promise<void> {
  const configs = await db.select().from(configuracionEtapasTable).where(eq(configuracionEtapasTable.activa, true)).orderBy(configuracionEtapasTable.ordenVisualizacion);

  for (const config of configs) {
    const [etapa] = await db.insert(etapasProcesoTable).values({
      idProceso,
      numeroEtapa: config.numeroEtapa,
      estado: config.numeroEtapa === configs[0]?.numeroEtapa ? "activa" : "pendiente",
      slaEtapaHoras: config.slaHoras,
      fechaInicio: config.numeroEtapa === configs[0]?.numeroEtapa ? new Date() : null,
    }).returning();

    const template = config.checklistTemplate as { descripcion: string; area?: string; notificarUsuarioIds?: number[] }[];
    for (const item of template) {
      await db.insert(checklistItemsTable).values({
        idEtapaProceso: etapa.id,
        descripcion: item.descripcion,
        areaResponsable: item.area ?? null,
        completado: false,
        notificarUsuarioIds: item.notificarUsuarioIds ?? [],
      });
    }
  }
}

// GET /procesos
router.get("/procesos", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = ListProcesosQueryParams.safeParse(req.query);
  const conditions = [];

  if (params.success) {
    if (params.data.estado && params.data.estado !== "todos") conditions.push(eq(procesosTable.estadoActual, params.data.estado as any));
    if (params.data.prioridad) conditions.push(eq(procesosTable.prioridad, params.data.prioridad as any));
    if (params.data.busqueda) {
      conditions.push(or(
        ilike(procesosTable.numeroPreoferta, `%${params.data.busqueda}%`),
        ilike(procesosTable.clienteNombre, `%${params.data.busqueda}%`)
      ));
    }
  }

  const procesos = conditions.length > 0
    ? await db.select().from(procesosTable).where(and(...conditions)).orderBy(desc(procesosTable.fijado), desc(procesosTable.fechaInicio))
    : await db.select().from(procesosTable).orderBy(desc(procesosTable.fijado), desc(procesosTable.fechaInicio));

  const nombresEtapas = await getNombresEtapas();

  const result = await Promise.all(procesos.map(async (p) => {
    const etapas = await db.select().from(etapasProcesoTable).where(eq(etapasProcesoTable.idProceso, p.id));
    const etapaActiva = etapas.find(e => e.estado === "activa");
    const slaVencido = etapaActiva?.fechaInicio ? calcularSlaVencidoLaboral(etapaActiva.fechaInicio, etapaActiva.slaEtapaHoras) : false;
    const minutosRestantes = etapaActiva?.fechaInicio ? calcularMinutosRestantesLaboral(etapaActiva.fechaInicio, etapaActiva.slaEtapaHoras) : null;
    return {
      ...p,
      etapaActual: etapaActiva?.numeroEtapa ?? null,
      slaVencido,
      minutosRestantes,
      slaGlobalHoras: etapaActiva?.slaEtapaHoras ?? p.slaGlobalHoras,
    };
  }));

  res.json(result);
});

// POST /procesos — solo requiere numeroPreoferta
router.post("/procesos", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { numeroPreoferta, prioridad } = req.body;
  if (!numeroPreoferta?.trim()) {
    res.status(400).json({ error: "El número de preoferta es requerido" });
    return;
  }

  // Verificar que no existe ya
  const [existente] = await db.select().from(procesosTable).where(eq(procesosTable.numeroPreoferta, numeroPreoferta.trim()));
  if (existente) {
    res.status(409).json({ error: `Ya existe un proceso con la preoferta ${numeroPreoferta}` });
    return;
  }

  const configs = await db.select().from(configuracionEtapasTable).where(eq(configuracionEtapasTable.activa, true)).orderBy(configuracionEtapasTable.ordenVisualizacion);
  const primeraEtapa = configs[0];

  const [proceso] = await db.insert(procesosTable).values({
    numeroPreoferta: numeroPreoferta.trim(),
    estadoActual: primeraEtapa ? `en_fase_${primeraEtapa.numeroEtapa}` as any : "en_fase_1",
    clienteNombre: numeroPreoferta.trim(),
    prioridad: (prioridad as any) ?? "baja",
    slaGlobalHoras: primeraEtapa?.slaHoras ?? 24,
    usuarioCreadorId: req.usuario!.id,
  }).returning();

  await crearEtapasParaProceso(proceso.id);

  req.log.info({ procesoId: proceso.id }, "Proceso creado");
  res.status(201).json({ ...proceso, etapaActual: primeraEtapa?.numeroEtapa ?? 1, slaVencido: false });
});

// GET /procesos/dashboard
router.get("/procesos/dashboard", requireAuth, async (_req, res): Promise<void> => {
  const procesos = await db.select().from(procesosTable);
  const etapas = await db.select().from(etapasProcesoTable);
  const configs = await db.select().from(configuracionEtapasTable).where(eq(configuracionEtapasTable.activa, true)).orderBy(configuracionEtapasTable.numeroEtapa);

  const enProgreso = procesos.filter(p => p.estadoActual !== "completado" && p.estadoActual !== "en_espera").length;
  const completados = procesos.filter(p => p.estadoActual === "completado").length;
  const urgentes = procesos.filter(p => p.prioridad === "urgente" || p.prioridad === "alta").length;

  const vencidos = procesos.filter(p => {
    if (p.estadoActual === "completado") return false;
    const ea = etapas.find(e => e.idProceso === p.id && e.estado === "activa");
    return ea?.fechaInicio ? calcularSlaVencidoLaboral(ea.fechaInicio, ea.slaEtapaHoras) : false;
  }).length;

  const porFase = configs.map(c => ({
    fase: c.numeroEtapa,
    nombre: c.nombreEtapa,
    color: c.color,
    cantidad: procesos.filter(p => p.estadoActual === `en_fase_${c.numeroEtapa}`).length,
  }));

  res.json({ totalProcesos: procesos.length, enProgreso, completados, vencidos, urgentes, porFase });
});

// GET /procesos/:id
router.get("/procesos/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
  if (!proceso) { res.status(404).json({ error: "Proceso no encontrado" }); return; }

  const etapas = await db.select().from(etapasProcesoTable).where(eq(etapasProcesoTable.idProceso, id)).orderBy(etapasProcesoTable.numeroEtapa);
  const etapaActiva = etapas.find(e => e.estado === "activa");
  const configs = await db.select().from(configuracionEtapasTable);
  const configMap: Record<number, typeof configs[0]> = {};
  for (const c of configs) configMap[c.numeroEtapa] = c;

  const etapasConInfo = etapas.map(e => ({
    ...e,
    nombreEtapa: configMap[e.numeroEtapa]?.nombreEtapa ?? `Etapa ${e.numeroEtapa}`,
    color: configMap[e.numeroEtapa]?.color ?? "#DC2626",
    slaVencido: e.fechaInicio ? calcularSlaVencidoLaboral(e.fechaInicio, e.slaEtapaHoras) : false,
    minutosRestantes: e.fechaInicio ? calcularMinutosRestantesLaboral(e.fechaInicio, e.slaEtapaHoras) : null,
  }));

  const slaVencido = etapaActiva?.fechaInicio ? calcularSlaVencidoLaboral(etapaActiva.fechaInicio, etapaActiva.slaEtapaHoras) : false;

  res.json({
    ...proceso,
    etapaActual: etapaActiva?.numeroEtapa ?? null,
    slaVencido,
    slaGlobalHoras: etapaActiva?.slaEtapaHoras ?? proceso.slaGlobalHoras,
    etapas: etapasConInfo,
  });
});

// PUT /procesos/:id
router.put("/procesos/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateProcesoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [updated] = await db.update(procesosTable).set(parsed.data).where(eq(procesosTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json({ ...updated, etapaActual: null, slaVencido: false });
});

// POST /procesos/:id/priorizar
router.post("/procesos/:id/priorizar", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = PriorizarProcesoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { fijado: parsed.data.fijado };
  if (parsed.data.prioridad) updateData.prioridad = parsed.data.prioridad;
  const [updated] = await db.update(procesosTable).set(updateData as any).where(eq(procesosTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json({ ...updated, etapaActual: null, slaVencido: false });
});

export default router;
