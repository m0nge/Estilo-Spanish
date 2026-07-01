import { db, etapasProcesoTable, procesosTable, notificacionesTable, usuariosTable, configuracionEtapasTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { emailSlaAlerta, emailSlaVencidoAdmin } from "../lib/email";
import { calcularMinutosRestantesLaboral } from "../lib/businessHours";

const SLA_NOTIFIED_PROXIMO = new Set<string>();
const SLA_NOTIFIED_VENCIDO = new Set<string>();

export async function checkSla(): Promise<void> {
  try {
    const etapasActivas = await db.select().from(etapasProcesoTable).where(and(eq(etapasProcesoTable.estado, "activa")));

    for (const etapa of etapasActivas) {
      if (!etapa.fechaInicio) continue;

      const minutosRestantesVal = calcularMinutosRestantesLaboral(etapa.fechaInicio, etapa.slaEtapaHoras);
      const horasRestantes = minutosRestantesVal / 60;
      const keyProximo = `proximo-${etapa.id}`;
      const keyVencido = `vencido-${etapa.id}`;

      const [proceso] = await db.select().from(procesosTable).where(eq(procesosTable.id, etapa.idProceso));
      if (!proceso) continue;

      const [config] = await db.select().from(configuracionEtapasTable).where(eq(configuracionEtapasTable.numeroEtapa, etapa.numeroEtapa));
      const nombreEtapa = config?.nombreEtapa ?? `Etapa ${etapa.numeroEtapa}`;
      const areas = (config?.areasInvolucradas as string[]) ?? [];
      const todosUsuarios = await db.select().from(usuariosTable).where(eq(usuariosTable.activo, true));
      const destinatarios = todosUsuarios.filter(u => areas.includes(u.rol));
      const admins = todosUsuarios.filter(u => u.rol === "Admin" && u.email);

      // SLA próximo (menos del 20% restante)
      if (horasRestantes > 0 && horasRestantes <= etapa.slaEtapaHoras * 0.2 && !SLA_NOTIFIED_PROXIMO.has(keyProximo)) {
        SLA_NOTIFIED_PROXIMO.add(keyProximo);
        for (const dest of destinatarios) {
          await db.insert(notificacionesTable).values({
            usuarioDestinoId: dest.id,
            idProceso: etapa.idProceso,
            tipo: "sla_proximo",
            titulo: `⚠️ SLA por vencer — Orden ${proceso.numeroPreoferta}`,
            mensaje: `La etapa "${nombreEtapa}" de la orden ${proceso.numeroPreoferta} vence en ${Math.ceil(horasRestantes)}h laborales.`,
            leido: false,
          }).catch(() => {});
        }
        if (destinatarios.length > 0) {
          emailSlaAlerta({
            tipo: "proximo",
            numeroPreoferta: proceso.numeroPreoferta,
            clienteNombre: proceso.clienteNombre ?? proceso.numeroPreoferta,
            nombreEtapa,
            numeroEtapa: etapa.numeroEtapa,
            horasRestantes: Math.ceil(horasRestantes),
            procesoId: proceso.id,
            destinatarios: destinatarios.filter(d => d.email).map(d => ({ nombre: d.nombre, email: d.email })),
          }).catch(() => {});
        }
      }

      // SLA vencido → notificar + email admin
      if (horasRestantes <= 0 && !SLA_NOTIFIED_VENCIDO.has(keyVencido)) {
        SLA_NOTIFIED_VENCIDO.add(keyVencido);
        for (const dest of todosUsuarios) {
          await db.insert(notificacionesTable).values({
            usuarioDestinoId: dest.id,
            idProceso: etapa.idProceso,
            tipo: "sla_vencido",
            titulo: `🚨 SLA VENCIDO — Orden ${proceso.numeroPreoferta}`,
            mensaje: `La etapa "${nombreEtapa}" de la orden ${proceso.numeroPreoferta} tiene el SLA vencido hace ${Math.abs(Math.ceil(horasRestantes))}h laborales.`,
            leido: false,
          }).catch(() => {});
        }
        // Email directo al admin
        for (const admin of admins) {
          emailSlaVencidoAdmin({
            numeroPreoferta: proceso.numeroPreoferta,
            clienteNombre: proceso.clienteNombre ?? proceso.numeroPreoferta,
            nombreEtapa,
            numeroEtapa: etapa.numeroEtapa,
            procesoId: proceso.id,
            adminEmail: admin.email,
          }).catch(() => {});
        }
        logger.info({ procesoId: proceso.id, etapa: etapa.numeroEtapa }, "SLA vencido — notificaciones enviadas al admin");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error en SLA checker");
  }
}

export function startSlaChecker(): void {
  logger.info("SLA checker iniciado (cada 10 min)");
  checkSla().catch(() => {});
  setInterval(() => checkSla().catch(() => {}), 10 * 60 * 1000);
}
