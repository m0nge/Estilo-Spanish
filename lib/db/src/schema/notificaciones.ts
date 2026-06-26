import { pgTable, text, serial, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usuariosTable } from "./usuarios";
import { procesosTable } from "./procesos";

export const tipoNotificacionEnum = pgEnum("tipo_notificacion", [
  "etapa_lista", "sla_proximo", "sla_vencido", "chat_nuevo", "comentario_nuevo", "documento_faltante"
]);

export const notificacionesTable = pgTable("notificaciones", {
  id: serial("id").primaryKey(),
  usuarioDestinoId: integer("usuario_destino_id").notNull().references(() => usuariosTable.id),
  idProceso: integer("id_proceso").references(() => procesosTable.id),
  tipo: tipoNotificacionEnum("tipo").notNull(),
  titulo: text("titulo").notNull(),
  mensaje: text("mensaje").notNull(),
  leido: boolean("leido").notNull().default(false),
  fechaCreacion: timestamp("fecha_creacion", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificacionSchema = createInsertSchema(notificacionesTable).omit({ id: true, fechaCreacion: true });
export type InsertNotificacion = z.infer<typeof insertNotificacionSchema>;
export type Notificacion = typeof notificacionesTable.$inferSelect;
