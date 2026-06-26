import { pgTable, text, serial, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { procesosTable } from "./procesos";
import { usuariosTable } from "./usuarios";

export const estadoEtapaEnum = pgEnum("estado_etapa", ["pendiente", "activa", "completada"]);

export const etapasProcesoTable = pgTable("etapas_proceso", {
  id: serial("id").primaryKey(),
  idProceso: integer("id_proceso").notNull().references(() => procesosTable.id),
  numeroEtapa: integer("numero_etapa").notNull(),
  estado: estadoEtapaEnum("estado").notNull().default("pendiente"),
  fechaInicio: timestamp("fecha_inicio", { withTimezone: true }),
  fechaFin: timestamp("fecha_fin", { withTimezone: true }),
  slaEtapaHoras: integer("sla_etapa_horas").notNull().default(24),
  usuarioResponsableId: integer("usuario_responsable_id").references(() => usuariosTable.id),
  completadoPorId: integer("completado_por_id").references(() => usuariosTable.id),
  checklistCompletado: boolean("checklist_completado").notNull().default(false),
  justificacionRetraso: text("justificacion_retraso"),
});

export const insertEtapaSchema = createInsertSchema(etapasProcesoTable).omit({ id: true });
export type InsertEtapa = z.infer<typeof insertEtapaSchema>;
export type EtapaProceso = typeof etapasProcesoTable.$inferSelect;
