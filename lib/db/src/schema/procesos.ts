import { pgTable, text, serial, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";

export const estadoProcesoEnum = pgEnum("estado_proceso", [
  "en_espera", "en_fase_1", "en_fase_2", "en_fase_3", "en_fase_4", "en_fase_5", "completado"
]);

export const prioridadEnum = pgEnum("prioridad_proceso", ["baja", "media", "alta", "urgente"]);

export const procesosTable = pgTable("procesos", {
  id: serial("id").primaryKey(),
  numeroPreoferta: text("numero_preoferta").notNull().unique(),
  estadoActual: estadoProcesoEnum("estado_actual").notNull().default("en_espera"),
  clienteNombre: text("cliente_nombre").notNull(),
  clienteEmail: text("cliente_email"),
  clienteTelefono: text("cliente_telefono"),
  tipoCliente: text("tipo_cliente"),
  planSolicitado: text("plan_solicitado"),
  cantidadEquipos: integer("cantidad_equipos").default(1),
  fechaInicio: timestamp("fecha_inicio", { withTimezone: true }).notNull().defaultNow(),
  fechaFinEstimada: timestamp("fecha_fin_estimada", { withTimezone: true }),
  fechaFinReal: timestamp("fecha_fin_real", { withTimezone: true }),
  slaGlobalHoras: integer("sla_global_horas").notNull().default(120),
  prioridad: prioridadEnum("prioridad").notNull().default("baja"),
  fijado: boolean("fijado").notNull().default(false),
  justificacionRetraso: text("justificacion_retraso"),
  usuarioCreadorId: integer("usuario_creador_id").references(() => usuariosTable.id),
  codigoStr: text("codigo_str"),
  codigoB800: text("codigo_b800"),
  codigoR800: text("codigo_r800"),
});

export const insertProcesoSchema = createInsertSchema(procesosTable).omit({ id: true, fechaInicio: true });
export type InsertProceso = z.infer<typeof insertProcesoSchema>;
export type Proceso = typeof procesosTable.$inferSelect;
