import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etapasProcesoTable } from "./etapas";
import { usuariosTable } from "./usuarios";

export const checklistItemsTable = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  idEtapaProceso: integer("id_etapa_proceso").notNull().references(() => etapasProcesoTable.id),
  descripcion: text("descripcion").notNull(),
  completado: boolean("completado").notNull().default(false),
  usuarioQuienCompletoId: integer("usuario_quien_completo_id").references(() => usuariosTable.id),
  fechaCompletado: timestamp("fecha_completado", { withTimezone: true }),
  notas: text("notas"),
});

export const insertChecklistItemSchema = createInsertSchema(checklistItemsTable).omit({ id: true });
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItemsTable.$inferSelect;
