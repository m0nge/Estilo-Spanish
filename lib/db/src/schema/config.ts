import { pgTable, text, serial, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const configuracionEtapasTable = pgTable("configuracion_etapas", {
  id: serial("id").primaryKey(),
  numeroEtapa: integer("numero_etapa").notNull().unique(),
  nombreEtapa: text("nombre_etapa").notNull(),
  descripcion: text("descripcion"),
  slaHoras: integer("sla_horas").notNull().default(24),
  areasInvolucradas: json("areas_involucradas").$type<string[]>().notNull().default([]),
  checklistTemplate: json("checklist_template").$type<{ descripcion: string; area?: string }[]>().notNull().default([]),
  activa: boolean("activa").notNull().default(true),
  ordenVisualizacion: integer("orden_visualizacion").notNull().default(1),
});

export const configuracionSlaTable = pgTable("configuracion_sla", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().default("Configuración Global"),
  slaGlobalHoras: integer("sla_global_horas").notNull().default(120),
  alertaPorcentaje: integer("alerta_porcentaje").notNull().default(80),
  activo: boolean("activo").notNull().default(true),
});

export const insertConfigEtapaSchema = createInsertSchema(configuracionEtapasTable).omit({ id: true });
export type InsertConfigEtapa = z.infer<typeof insertConfigEtapaSchema>;
export type ConfigEtapa = typeof configuracionEtapasTable.$inferSelect;

export const insertSlaConfigSchema = createInsertSchema(configuracionSlaTable).omit({ id: true });
export type InsertSlaConfig = z.infer<typeof insertSlaConfigSchema>;
export type SlaConfig = typeof configuracionSlaTable.$inferSelect;
