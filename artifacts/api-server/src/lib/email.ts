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
