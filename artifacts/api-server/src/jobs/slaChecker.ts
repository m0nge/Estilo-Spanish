import { db, etapasProcesoTable, procesosTable, notificacionesTable, usuariosTable, configuracionEtapasTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { emailSlaAlerta } from "../lib/email";

const NOMBRES_ETAPAS: Record<number, string> = {
  1: "Documentación y Digitalización",
  2: "STR y Despacho",
  3: "Configuración de Dispositivos",
  4: "Armado y Configuración Física",
  5: "Entrega y Capacitación",
};

function minutosRestantes(fechaInicio: Date, slaHoras: number): number {
  const limite = new Date(fechaInicio.getTime() + slaHoras * 60 * 60 * 1000);
  return Math.floor((limite.getTime() - Date.now()) / 60000);
}

const SLA_NOTIFIED_PROXIMO = new Set<string>();
const SLA_NOTIFIED_VENCIDO = new Set<string>();

export async function checkSla(): Promise<void> {
  try {
    const etapasActivas = await db
      .select()
      .from(etapasProcesoTable)
      .where(and(eq(etapasProcesoTable.estado, "activa")));

    for (const etapa of etapasActivas) {
      if (!etapa.fechaInicio) continue;

      const minutos = minutosRestantes(etapa.fechaInicio, etapa.slaEtapaHoras);
      const horas = minutos / 60;
      const keyProximo = `proximo-${etapa.id}`;
      const keyVencido = `vencido-${etapa.id}`;

      const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, etapa.idProceso));
      if (!proceso) continue;

      const [config] = await db.select().from(configuracionEtapasTable).where(eq(configuracionEtapasTable.numeroEtapa, etapa.numeroEtapa));
      const areas = (config?.areasInvolucradas as string[]) ?? [];
      const todosUsuarios = await db.select().from(usuariosTable).where(eq(usuariosTable.activo, true));
      const destinatarios = todosUsuarios.filter(u => areas.includes(u.rol));

      if (horas > 0 && horas <= (etapa.slaEtapaHoras * 0.2) && !SLA_NOTIFIED_PROXIMO.has(keyProximo)) {
        SLA_NOTIFIED_PROXIMO.add(keyProximo);

        for (const dest of destinatarios) {
          await db.insert(notificacionesTable).values({
            usuarioDestinoId: dest.id,
            idProceso: etapa.idProceso,
            tipo: "sla_proximo",
            titulo: `⚠️ SLA por vencer — Orden ${proceso.numeroPreoferta}`,
            mensaje: `La etapa "${NOMBRES_ETAPAS[etapa.numeroEtapa]}" del proceso ${proceso.numeroPreoferta} (${proceso.clienteNombre}) vence en menos de ${Math.ceil(horas)}h.`,
            leido: false,
          }).catch(() => {});
        }

        if (destinatarios.length > 0) {
          emailSlaAlerta({
            tipo: "proximo",
            numeroPreoferta: proceso.numeroPreoferta,
            clienteNombre: proceso.clienteNombre,
            nombreEtapa: NOMBRES_ETAPAS[etapa.numeroEtapa] ?? `Etapa ${etapa.numeroEtapa}`,
            numeroEtapa: etapa.numeroEtapa,
            horasRestantes: Math.ceil(horas),
            procesoId: proceso.id,
            destinatarios: destinatarios.filter(d => d.email).map(d => ({ nombre: d.nombre, email: d.email })),
          }).catch(() => {});
        }

        logger.info({ procesoId: proceso.id, etapa: etapa.numeroEtapa }, "SLA próximo a vencer — notificaciones enviadas");
      }

      if (horas <= 0 && !SLA_NOTIFIED_VENCIDO.has(keyVencido)) {
        SLA_NOTIFIED_VENCIDO.add(keyVencido);

        for (const dest of destinatarios) {
          await db.insert(notificacionesTable).values({
            usuarioDestinoId: dest.id,
            idProceso: etapa.idProceso,
            tipo: "sla_vencido",
            titulo: `🚨 SLA VENCIDO — Orden ${proceso.numeroPreoferta}`,
            mensaje: `La etapa "${NOMBRES_ETAPAS[etapa.numeroEtapa]}" del proceso ${proceso.numeroPreoferta} (${proceso.clienteNombre}) tiene el SLA vencido hace ${Math.abs(Math.ceil(horas))}h.`,
            leido: false,
          }).catch(() => {});
        }

        if (destinatarios.length > 0) {
          emailSlaAlerta({
            tipo: "vencido",
            numeroPreoferta: proceso.numeroPreoferta,
            clienteNombre: proceso.clienteNombre,
            nombreEtapa: NOMBRES_ETAPAS[etapa.numeroEtapa] ?? `Etapa ${etapa.numeroEtapa}`,
            numeroEtapa: etapa.numeroEtapa,
            horasRestantes: Math.abs(Math.ceil(horas)),
            procesoId: proceso.id,
            destinatarios: destinatarios.filter(d => d.email).map(d => ({ nombre: d.nombre, email: d.email })),
          }).catch(() => {});
        }

        logger.info({ procesoId: proceso.id, etapa: etapa.numeroEtapa }, "SLA vencido — notificaciones enviadas");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error en SLA checker");
  }
}

export function startSlaChecker(): void {
  const INTERVAL_MS = 10 * 60 * 1000;
  logger.info("SLA checker iniciado (cada 10 min)");
  checkSla().catch(() => {});
  setInterval(() => checkSla().catch(() => {}), INTERVAL_MS);
}
