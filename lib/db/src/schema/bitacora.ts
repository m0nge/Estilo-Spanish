import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { procesosTable } from "./procesos";
import { etapasProcesoTable } from "./etapas";
import { checklistItemsTable } from "./checklist";
import { usuariosTable } from "./usuarios";

export const bitacoraEntradasTable = pgTable("bitacora_entradas", {
  id: serial("id").primaryKey(),
  procesoId: integer("proceso_id").notNull().references(() => procesosTable.id),
  etapaProcesoId: integer("etapa_proceso_id").references(() => etapasProcesoTable.id),
  checklistItemId: integer("checklist_item_id").references(() => checklistItemsTable.id),
  autorId: integer("autor_id").references(() => usuariosTable.id),
  contactoNombre: text("contacto_nombre"),
  contactoTelefono: text("contacto_telefono"),
  comentario: text("comentario").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBitacoraSchema = createInsertSchema(bitacoraEntradasTable).omit({ id: true, creadoEn: true });
export type InsertBitacora = z.infer<typeof insertBitacoraSchema>;
export type BitacoraEntrada = typeof bitacoraEntradasTable.$inferSelect;
