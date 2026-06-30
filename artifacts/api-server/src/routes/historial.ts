import { Router } from "express";
import { db, etapasProcesoTable, procesosTable, usuariosTable, checklistItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { NOMBRES_ETAPAS, calcularSlaVencido } from "./procesos";

const router = Router();

// GET /procesos/:id/historial
router.get("/procesos/:id/historial", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, id));
  if (!proceso) { res.status(404).json({ error: "Proceso no encontrado" }); return; }

  const etapas = await db.select().from(etapasProcesoTable)
    .where(eq(etapasProcesoTable.idProceso, id))
    .orderBy(etapasProcesoTable.numeroEtapa);

  const usuarios = await db.select().from(usuariosTable);
  const usuarioMap = new Map(usuarios.map(u => [u.id, u]));

  const items: object[] = [];

  // Evento: proceso creado
  items.push({
    tipo: "proceso_creado",
    fecha: proceso.fechaInicio,
    titulo: "Proceso iniciado",
    descripcion: `Orden ${proceso.numeroPreoferta} creada para ${proceso.clienteNombre}`,
    usuarioNombre: proceso.usuarioCreadorId ? (usuarioMap.get(proceso.usuarioCreadorId)?.nombre ?? "Sistema") : "Sistema",
    usuarioRol: proceso.usuarioCreadorId ? (usuarioMap.get(proceso.usuarioCreadorId)?.rol ?? "") : "",
    icono: "inicio",
    color: "blue",
  });

  for (const etapa of etapas) {
    const nombreEtapa = NOMBRES_ETAPAS[etapa.numeroEtapa] ?? `Etapa ${etapa.numeroEtapa}`;
    const completadoPor = etapa.completadoPorId ? usuarioMap.get(etapa.completadoPorId) : null;

    // Evento: etapa iniciada
    if (etapa.fechaInicio && (etapa.estado === "activa" || etapa.estado === "completada")) {
      items.push({
        tipo: "etapa_iniciada",
        etapaNumero: etapa.numeroEtapa,
        fecha: etapa.fechaInicio,
        titulo: `Etapa ${etapa.numeroEtapa} iniciada`,
        descripcion: nombreEtapa,
        usuarioNombre: null,
        usuarioRol: null,
        icono: "inicio_etapa",
        color: "gray",
      });
    }

    // Evento: justificación
    if (etapa.justificacionRetraso) {
      items.push({
        tipo: "justificacion",
        etapaNumero: etapa.numeroEtapa,
        fecha: etapa.fechaFin ?? etapa.fechaInicio,
        titulo: `Justificación en Etapa ${etapa.numeroEtapa}`,
        descripcion: etapa.justificacionRetraso,
        usuarioNombre: completadoPor?.nombre ?? null,
        usuarioRol: completadoPor?.rol ?? null,
        icono: "alerta",
        color: "orange",
      });
    }

    // Evento: etapa completada
    if (etapa.estado === "completada" && etapa.fechaFin) {
      const slaVencida = etapa.fechaInicio ? calcularSlaVencido(etapa.fechaInicio, etapa.slaEtapaHoras) : false;
      const duracionMs = etapa.fechaFin.getTime() - (etapa.fechaInicio?.getTime() ?? etapa.fechaFin.getTime());
      const duracionH = Math.round(duracionMs / 3600000 * 10) / 10;

      // Conteo de checklist
      const checkItems = await db.select().from(checklistItemsTable)
        .where(eq(checklistItemsTable.idEtapaProceso, etapa.id));
      const totalItems = checkItems.length;
      const completadosItems = checkItems.filter(i => i.completado).length;

      items.push({
        tipo: "etapa_completada",
        etapaNumero: etapa.numeroEtapa,
        fecha: etapa.fechaFin,
        titulo: `Etapa ${etapa.numeroEtapa} completada`,
        descripcion: nombreEtapa,
        usuarioNombre: completadoPor?.nombre ?? "Sistema",
        usuarioRol: completadoPor?.rol ?? "",
        duracionHoras: duracionH,
        checklistTotal: totalItems,
        checklistCompletados: completadosItems,
        conJustificacion: !!etapa.justificacionRetraso,
        slaVencidaAlCompletar: slaVencida,
        icono: "completado",
        color: slaVencida ? "red" : "green",
      });
    }
  }

  // Evento: proceso completado
  if (proceso.estadoActual === "completado" && proceso.fechaFinReal) {
    const duracionTotal = proceso.fechaFinReal.getTime() - proceso.fechaInicio.getTime();
    const diasTotal = Math.round(duracionTotal / 86400000 * 10) / 10;
    items.push({
      tipo: "proceso_completado",
      fecha: proceso.fechaFinReal,
      titulo: "✅ Proceso completado",
      descripcion: `${diasTotal} días en total · SLA: ${proceso.slaGlobalHoras}h`,
      usuarioNombre: null,
      usuarioRol: null,
      icono: "completado_final",
      color: "green",
    });
  }

  // Ordenar por fecha
  items.sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  res.json(items);
});

export default router;
