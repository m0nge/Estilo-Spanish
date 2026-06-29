import { Router } from "express";
import { db, procesosTable, etapasProcesoTable, checklistItemsTable, usuariosTable, configuracionEtapasTable, configuracionSlaTable, notificacionesTable } from "@workspace/db";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { CreateProcesoBody, ListProcesosQueryParams, UpdateProcesoBody, PriorizarProcesoBody } from "@workspace/api-zod";

const router = Router();

const NOMBRES_ETAPAS = [
  "", // 0-indexed padding
  "Documentación y Digitalización",
  "STR y Despacho",
  "Configuración de Dispositivos",
  "Armado y Configuración Física",
  "Entrega y Capacitación",
];

function calcularSlaVencido(fechaInicio: Date, slaHoras: number): boolean {
  const limite = new Date(fechaInicio.getTime() + slaHoras * 60 * 60 * 1000);
  return new Date() > limite;
}

function calcularMinutosRestantes(fechaInicio: Date, slaHoras: number): number {
  const limite = new Date(fechaInicio.getTime() + slaHoras * 60 * 60 * 1000);
  return Math.floor((limite.getTime() - Date.now()) / 60000);
}

function generatePreofertaId(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const num = String(Math.floor(Math.random() * 99999) + 1).padStart(5, "0");
  return `PO-${year}-${month}-${num}`;
}

async function crearEtapasParaProceso(idProceso: number): Promise<void> {
  const configs = await db.select().from(configuracionEtapasTable).orderBy(configuracionEtapasTable.numeroEtapa);
  
  for (const config of configs) {
    const etapa = await db.insert(etapasProcesoTable).values({
      idProceso,
      numeroEtapa: config.numeroEtapa,
      estado: config.numeroEtapa === 1 ? "activa" : "pendiente",
      slaEtapaHoras: config.slaHoras,
      fechaInicio: config.numeroEtapa === 1 ? new Date() : null,
    }).returning();

    // Crear checklist items desde el template
    const template = config.checklistTemplate as { descripcion: string; area?: string }[];
    for (const item of template) {
      await db.insert(checklistItemsTable).values({
        idEtapaProceso: etapa[0].id,
        descripcion: item.descripcion,
        areaResponsable: item.area ?? null,
        completado: false,
      });
    }
  }
}

// GET /procesos
router.get("/procesos", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = ListProcesosQueryParams.safeParse(req.query);
  
  let query = db.select().from(procesosTable);
  const conditions = [];

  if (params.success) {
    if (params.data.estado) {
      conditions.push(eq(procesosTable.estadoActual, params.data.estado as any));
    }
    if (params.data.prioridad) {
      conditions.push(eq(procesosTable.prioridad, params.data.prioridad as any));
    }
    if (params.data.busqueda) {
      conditions.push(
        or(
          ilike(procesosTable.numeroPreoferta, `%${params.data.busqueda}%`),
          ilike(procesosTable.clienteNombre, `%${params.data.busqueda}%`)
        )
      );
    }
  }

  const procesos = conditions.length > 0
    ? await db.select().from(procesosTable).where(and(...conditions)).orderBy(desc(procesosTable.fijado), desc(procesosTable.prioridad))
    : await db.select().from(procesosTable).orderBy(desc(procesosTable.fijado), desc(procesosTable.prioridad));

  // Obtener etapa activa para cada proceso
  const result = await Promise.all(procesos.map(async (p) => {
    const etapas = await db.select().from(etapasProcesoTable).where(eq(etapasProcesoTable.idProceso, p.id));
    const etapaActiva = etapas.find(e => e.estado === "activa");
    
    return {
      ...p,
      etapaActual: etapaActiva?.numeroEtapa ?? null,
      slaVencido: calcularSlaVencido(p.fechaInicio, p.slaGlobalHoras),
    };
  }));

  res.json(result);
});

// POST /procesos
router.post("/procesos", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateProcesoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const slaConfig = await db.select().from(configuracionSlaTable).where(eq(configuracionSlaTable.activo, true)).limit(1);
  const slaHoras = slaConfig[0]?.slaGlobalHoras ?? 120;
  const fechaInicio = new Date();
  const fechaFinEstimada = new Date(fechaInicio.getTime() + slaHoras * 60 * 60 * 1000);

  const [proceso] = await db.insert(procesosTable).values({
    numeroPreoferta: generatePreofertaId(),
    estadoActual: "en_fase_1",
    clienteNombre: parsed.data.clienteNombre,
    clienteEmail: parsed.data.clienteEmail,
    clienteTelefono: parsed.data.clienteTelefono,
    tipoCliente: parsed.data.tipoCliente,
    planSolicitado: parsed.data.planSolicitado,
    cantidadEquipos: parsed.data.cantidadEquipos,
    prioridad: (parsed.data.prioridad as any) ?? "baja",
    slaGlobalHoras: slaHoras,
    fechaFinEstimada,
    usuarioCreadorId: req.usuario!.id,
  }).returning();

  await crearEtapasParaProceso(proceso.id);

  req.log.info({ procesoId: proceso.id }, "Proceso creado");
  res.status(201).json({ ...proceso, etapaActual: 1, slaVencido: false });
});

// GET /procesos/dashboard
router.get("/procesos/dashboard", requireAuth, async (_req, res): Promise<void> => {
  const procesos = await db.select().from(procesosTable);
  
  const totalProcesos = procesos.length;
  const enProgreso = procesos.filter(p => p.estadoActual !== "completado" && p.estadoActual !== "en_espera").length;
  const completados = procesos.filter(p => p.estadoActual === "completado").length;
  const urgentes = procesos.filter(p => p.prioridad === "urgente").length;
  const vencidos = procesos.filter(p => calcularSlaVencido(p.fechaInicio, p.slaGlobalHoras) && p.estadoActual !== "completado").length;

  const porFase = [1, 2, 3, 4, 5].map(fase => ({
    fase,
    nombre: NOMBRES_ETAPAS[fase],
    cantidad: procesos.filter(p => p.estadoActual === `en_fase_${fase}`).length,
  }));

  res.json({ totalProcesos, enProgreso, completados, vencidos, urgentes, porFase });
});

// GET /procesos/:id
router.get("/procesos/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
  if (!proceso) { res.status(404).json({ error: "Proceso no encontrado" }); return; }

  const etapas = await db.select().from(etapasProcesoTable).where(eq(etapasProcesoTable.idProceso, id)).orderBy(etapasProcesoTable.numeroEtapa);
  const etapaActiva = etapas.find(e => e.estado === "activa");

  const etapasConInfo = etapas.map(e => ({
    ...e,
    nombreEtapa: NOMBRES_ETAPAS[e.numeroEtapa],
    slaVencido: e.fechaInicio ? calcularSlaVencido(e.fechaInicio, e.slaEtapaHoras) : false,
    minutosRestantes: e.fechaInicio ? calcularMinutosRestantes(e.fechaInicio, e.slaEtapaHoras) : null,
  }));

  res.json({
    ...proceso,
    etapaActual: etapaActiva?.numeroEtapa ?? null,
    slaVencido: calcularSlaVencido(proceso.fechaInicio, proceso.slaGlobalHoras),
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

  res.json({ ...updated, etapaActual: null, slaVencido: calcularSlaVencido(updated.fechaInicio, updated.slaGlobalHoras) });
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

  res.json({ ...updated, etapaActual: null, slaVencido: calcularSlaVencido(updated.fechaInicio, updated.slaGlobalHoras) });
});

export { NOMBRES_ETAPAS, calcularSlaVencido, calcularMinutosRestantes };
export default router;
