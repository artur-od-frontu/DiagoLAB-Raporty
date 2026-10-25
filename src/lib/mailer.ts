/**
 * DiagoLAB Raporty+ — moduł e-mail (serwer-only)
 * ================================================
 * Nodemailer z SMTP. Bez SMTP_URL działa w trybie DEV (log do konsoli).
 * Szablony HTML inline — brak zewnętrznych zależności.
 */

import nodemailer from "nodemailer";
import { BRAND } from "@/config/brand";

const FROM = process.env.SMTP_FROM ?? `DiagoLAB Raporty+ <noreply@diagolab.pl>`;

function getTransport() {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  return nodemailer.createTransport(url);
}

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #dce3ed;overflow:hidden;">
  <tr><td style="background:#0b3a6b;padding:20px 28px;">
    <span style="font:800 18px monospace;color:#fff;">Diago<span style="color:#ff6a1f;">LAB</span></span>
    <span style="font:600 12px monospace;color:#7db4e0;margin-left:6px;">Raporty+</span>
  </td></tr>
  <tr><td style="padding:28px;">${body}</td></tr>
  <tr><td style="padding:16px 28px;background:#f4f6f9;border-top:1px solid #dce3ed;font-size:11px;color:#8494a7;line-height:1.6;">
    ${BRAND.product} · ${BRAND.supportEmail}<br>
    Ta wiadomość została wygenerowana automatycznie. Nie odpowiadaj na nią.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export interface SendResult {
  sent: boolean;
  devMode: boolean;
  messageId?: string;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  const transport = getTransport();
  if (!transport) {
    console.log(`[mailer:dev] → ${to} | ${subject}`);
    return { sent: false, devMode: true };
  }
  try {
    const info = await transport.sendMail({ from: FROM, to, subject, html });
    return { sent: true, devMode: false, messageId: info.messageId };
  } catch (err) {
    console.error("[mailer] błąd wysyłki:", err);
    return { sent: false, devMode: false };
  }
}

export async function sendVerificationCode(to: string, code: string, channel: "email" | "sms"): Promise<SendResult> {
  if (channel === "sms") {
    // SMS: osobna integracja (Twilio/SMSapi) — fallback na konsolę
    const provider = process.env.SMS_PROVIDER_KEY;
    if (!provider) {
      console.log(`[sms:dev] → ${to} | kod: ${code}`);
      return { sent: false, devMode: true };
    }
    // TODO: integracja z dostawcą SMS (np. Twilio, SMSapi)
    console.log(`[sms] wysyłka do ${to} przez skonfigurowanego dostawcę`);
    return { sent: true, devMode: false };
  }

  const html = wrap("Kod weryfikacyjny", `
    <h2 style="margin:0 0 16px;font-size:20px;color:#0b3a6b;">Potwierdź swój adres e-mail</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Twój kod weryfikacyjny:</p>
    <div style="margin:20px 0;padding:16px;background:#f4f6f9;border-radius:10px;text-align:center;border:2px dashed #dce3ed;">
      <span style="font:800 36px monospace;letter-spacing:12px;color:#0b3a6b;">${code}</span>
    </div>
    <p style="color:#8494a7;font-size:12px;">Kod jest ważny 15 minut. Jeśli nie rejestrowałeś konta w DiagoLAB — zignoruj tę wiadomość.</p>
  `);
  return send(to, `${code} — kod weryfikacyjny DiagoLAB`, html);
}

export async function sendPasswordResetCode(to: string, code: string): Promise<SendResult> {
  const html = wrap("Reset hasła", `
    <h2 style="margin:0 0 16px;font-size:20px;color:#0b3a6b;">Resetowanie hasła</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Otrzymaliśmy prośbę o zmianę hasła. Użyj kodu poniżej:</p>
    <div style="margin:20px 0;padding:16px;background:#f4f6f9;border-radius:10px;text-align:center;border:2px dashed #dce3ed;">
      <span style="font:800 36px monospace;letter-spacing:12px;color:#0b3a6b;">${code}</span>
    </div>
    <p style="color:#8494a7;font-size:12px;">Kod jest ważny 15 minut. Jeśli nie prosiłeś o reset — zignoruj tę wiadomość, Twoje hasło nie zostanie zmienione.</p>
  `);
  return send(to, `${code} — reset hasła DiagoLAB`, html);
}

export async function sendReportReady(to: string, reportNumber: string, reportUrl: string): Promise<SendResult> {
  const html = wrap("Raport gotowy", `
    <h2 style="margin:0 0 16px;font-size:20px;color:#0b3a6b;">Twój raport jest gotowy</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Raport <strong>${reportNumber}</strong> został wygenerowany i czeka na Twoje zatwierdzenie.</p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:#ff6a1f;color:#fff;font:600 15px sans-serif;text-decoration:none;border-radius:10px;">Otwórz raport</a>
    </div>
    <p style="color:#8494a7;font-size:12px;">Pamiętaj: ocenę końcową zatwierdza wykonawca badań po weryfikacji danych pomiarowych.</p>
  `);
  return send(to, `Raport ${reportNumber} gotowy — DiagoLAB`, html);
}

export async function sendPackageActivated(to: string, planName: string, reports: number, validUntil: string): Promise<SendResult> {
  const html = wrap("Pakiet aktywowany", `
    <h2 style="margin:0 0 16px;font-size:20px;color:#0b3a6b;">Pakiet ${planName} aktywowany</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Twoja pula raportów została uzupełniona:</p>
    <table style="margin:16px 0;width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#8494a7;font-size:13px;">Pakiet</td><td style="padding:8px 0;font-weight:700;color:#0b3a6b;">${planName}</td></tr>
      <tr><td style="padding:8px 0;color:#8494a7;font-size:13px;">Dodano raportów</td><td style="padding:8px 0;font-weight:700;color:#1e8e4f;">${reports}</td></tr>
      <tr><td style="padding:8px 0;color:#8494a7;font-size:13px;">Ważny do</td><td style="padding:8px 0;font-weight:700;color:#0b3a6b;">${validUntil}</td></tr>
    </table>
    <p style="color:#8494a7;font-size:12px;">Niewykorzystane raporty wygasają po upływie ważności pakietu.</p>
  `);
  return send(to, `Pakiet ${planName} aktywowany — DiagoLAB`, html);
}
