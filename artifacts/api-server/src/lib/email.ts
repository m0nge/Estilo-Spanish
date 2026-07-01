import nodemailer from "nodemailer";
import { logger } from "./logger";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "noreply@intelfon.cl";

const transporter = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];

  if (!transporter) {
    logger.info({ recipients, subject: opts.subject }, "[EMAIL-SIM] Correo simulado (configura SMTP_HOST, SMTP_USER, SMTP_PASS para envíos reales)");
    return;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: recipients.join(", "),
      subject: opts.subject,
      html: opts.html,
    });
    logger.info({ recipients, subject: opts.subject }, "Email enviado");
  } catch (err) {
    logger.error({ err, recipients, subject: opts.subject }, "Error enviando email");
  }
}

export function emailSlaAlerta(opts: {
  tipo: "proximo" | "vencido";
  numeroPreoferta: string;
  clienteNombre: string;
  nombreEtapa: string;
  numeroEtapa: number;
  horasRestantes: number;
  procesoId: number;
  destinatarios: { nombre: string; email: string }[];
}): Promise<void> {
  const { tipo, numeroPreoferta, clienteNombre, nombreEtapa, numeroEtapa, horasRestantes, procesoId, destinatarios } = opts;
  const esVencido = tipo === "vencido";
  const subject = esVencido
    ? `[URGENTE] SLA Vencido — Proceso ${numeroPreoferta}`
    : `[Alerta] SLA Próximo a Vencer — Proceso ${numeroPreoferta}`;

  const colorHeader = esVencido ? "#991B1B" : "#D97706";
  const icono = esVencido ? "🚨" : "⚠️";
  const tiempoTexto = esVencido
    ? `<strong style="color:#991B1B;">SLA VENCIDO hace ${Math.abs(horasRestantes)}h</strong>`
    : `Quedan aproximadamente <strong style="color:#D97706;">${horasRestantes}h</strong> antes de que venza el SLA`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${colorHeader}; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">${icono} Alerta SLA — Red Intelfon</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; font-size: 16px; margin-top: 0;">
          ${esVencido
            ? "Atención: El SLA de una etapa ha vencido y requiere acción inmediata."
            : "El SLA de una etapa está próximo a vencer. Por favor actúa con urgencia."}
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="color: #6b7280; padding: 4px 0; width: 40%;">Proceso:</td><td style="font-weight: bold; color: #111827;">${numeroPreoferta}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Cliente:</td><td style="font-weight: bold; color: #111827;">${clienteNombre}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Etapa en curso:</td><td style="font-weight: bold; color: ${colorHeader};">Etapa ${numeroEtapa}: ${nombreEtapa}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Estado SLA:</td><td>${tiempoTexto}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.APP_URL ?? "https://tu-app.replit.app"}/tracking/${procesoId}"
             style="background: ${colorHeader}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Ver Proceso Ahora →
          </a>
        </div>
      </div>
      <div style="padding: 12px; text-align: center; color: #9ca3af; font-size: 12px;">
        Red Intelfon — Workflow de Activaciones
      </div>
    </div>
  `;

  return sendEmail({ to: destinatarios.map(d => d.email), subject, html });
}

export function emailNotificacionChecklistItem(opts: {
  descripcion: string;
  procesoPreoferta: string;
  completadoPor: string;
  procesoId: number;
  destinatarios: { nombre: string; email: string }[];
}): Promise<void> {
  const { descripcion, procesoPreoferta, completadoPor, procesoId, destinatarios } = opts;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; padding: 16px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 18px;">✅ Tarea completada — Red Intelfon</h1>
      </div>
      <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb;">
        <p><strong>${completadoPor}</strong> marcó como completada la siguiente tarea:</p>
        <blockquote style="border-left: 3px solid #16a34a; margin: 12px 0; padding: 8px 16px; background: white;">${descripcion}</blockquote>
        <p style="color: #6b7280;">Proceso: <strong>${procesoPreoferta}</strong></p>
        <a href="${process.env.APP_URL ?? "https://tu-app.replit.app"}/tracking/${procesoId}"
           style="display:inline-block;background:#DC2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">
          Ver Proceso →
        </a>
      </div>
    </div>`;
  return sendEmail({ to: destinatarios.map(d => d.email), subject: `[Intelfon] Tarea completada — ${procesoPreoferta}`, html });
}

export function emailSlaVencidoAdmin(opts: {
  numeroPreoferta: string;
  clienteNombre: string;
  nombreEtapa: string;
  numeroEtapa: number;
  procesoId: number;
  adminEmail: string;
}): Promise<void> {
  const { numeroPreoferta, clienteNombre, nombreEtapa, numeroEtapa, procesoId, adminEmail } = opts;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#991B1B;padding:16px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:18px;">🚨 SLA Vencido — Acción requerida</h1>
      </div>
      <div style="padding:20px;background:#fef2f2;border:1px solid #fecaca;">
        <p>La Etapa <strong>${numeroEtapa}: ${nombreEtapa}</strong> del proceso <strong>${numeroPreoferta}</strong> (${clienteNombre}) ha superado su tiempo límite de SLA.</p>
        <a href="${process.env.APP_URL ?? "https://tu-app.replit.app"}/tracking/${procesoId}"
           style="display:inline-block;background:#991B1B;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Ver Proceso →
        </a>
      </div>
    </div>`;
  return sendEmail({ to: adminEmail, subject: `[URGENTE] SLA Vencido — ${numeroPreoferta}`, html });
}

export function emailMencion(opts: {
  mencionadoPor: string;
  procesoPreoferta: string;
  procesoId: number;
  mensaje: string;
  destinatarioEmail: string;
}): Promise<void> {
  const { mencionadoPor, procesoPreoferta, procesoId, mensaje, destinatarioEmail } = opts;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#3B82F6;padding:16px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:18px;">💬 Te mencionaron en Red Intelfon</h1>
      </div>
      <div style="padding:20px;background:#eff6ff;border:1px solid #bfdbfe;">
        <p><strong>${mencionadoPor}</strong> te mencionó en el proceso <strong>${procesoPreoferta}</strong>:</p>
        <blockquote style="border-left:3px solid #3B82F6;margin:12px 0;padding:8px 16px;background:white;">${mensaje}</blockquote>
        <a href="${process.env.APP_URL ?? "https://tu-app.replit.app"}/tracking/${procesoId}"
           style="display:inline-block;background:#3B82F6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">
          Ver Proceso →
        </a>
      </div>
    </div>`;
  return sendEmail({ to: destinatarioEmail, subject: `[Intelfon] Te mencionaron en ${procesoPreoferta}`, html });
}

export function emailEtapaLista(opts: {
  numeroEtapa: number;
  nombreEtapa: string;
  etapaAnterior: string;
  numeroPreoferta: string;
  clienteNombre: string;
  procesoId: number;
  destinatarios: { nombre: string; email: string }[];
}): Promise<void> {
  const { numeroEtapa, nombreEtapa, etapaAnterior, numeroPreoferta, clienteNombre, procesoId, destinatarios } = opts;
  const subject = `[Intelfon] Etapa ${numeroEtapa} lista — Proceso ${numeroPreoferta}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">🔔 Nueva Fase Lista — Red Intelfon</h1>
      </div>
      <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; font-size: 16px; margin-top: 0;">
          Hola, tienes una nueva fase asignada para continuar el proceso de activación.
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="color: #6b7280; padding: 4px 0; width: 40%;">Proceso:</td><td style="font-weight: bold; color: #111827;">${numeroPreoferta}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Cliente:</td><td style="font-weight: bold; color: #111827;">${clienteNombre}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Etapa anterior:</td><td style="color: #6b7280;">${etapaAnterior}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Tu fase:</td><td style="font-weight: bold; color: #DC2626; font-size: 16px;">Etapa ${numeroEtapa}: ${nombreEtapa}</td></tr>
          </table>
        </div>
        <p style="color: #374151;">
          Por favor ingresa al sistema y continúa con tu fase para no retrasar el SLA del proceso.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.APP_URL ?? "https://tu-app.replit.app"}/tracking/${procesoId}"
             style="background: #DC2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Ver Proceso →
          </a>
        </div>
      </div>
      <div style="padding: 12px; text-align: center; color: #9ca3af; font-size: 12px;">
        Red Intelfon — Workflow de Activaciones
      </div>
    </div>
  `;

  return sendEmail({
    to: destinatarios.map(d => d.email),
    subject,
    html,
  });
}
