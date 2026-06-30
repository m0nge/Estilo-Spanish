import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { procesosTable } from "./procesos";
import { usuariosTable } from "./usuarios";

export const chatMensajesTable = pgTable("chat_mensajes", {
  id: serial("id").primaryKey(),
  idProceso: integer("id_proceso").notNull().references(() => procesosTable.id),
  etapaOrigen: integer("etapa_origen").notNull(),
  etapaDestino: integer("etapa_destino").notNull(),
  usuarioRemitenteId: integer("usuario_remitente_id").notNull().references(() => usuariosTable.id),
  contenido: text("contenido").notNull().default(""),
  imagenBase64: text("imagen_base64"),
  fechaMensaje: timestamp("fecha_mensaje", { withTimezone: true }).notNull().defaultNow(),
  leido: boolean("leido").notNull().default(false),
});

export const insertChatMensajeSchema = createInsertSchema(chatMensajesTable).omit({ id: true, fechaMensaje: true });
export type InsertChatMensaje = z.infer<typeof insertChatMensajeSchema>;
export type ChatMensaje = typeof chatMensajesTable.$inferSelect;
