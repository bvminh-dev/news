/**
 * T9 — Mail adapter (Gmail SMTP qua nodemailer). Không render HTML thô nguồn
 * (nội dung đã sanitize ở domain). sendAlert gửi cảnh báo tới admin.
 */
import nodemailer, { Transporter } from 'nodemailer';
import { getConfig, isMailConfigured } from '@/lib/config';
import { log } from '@/lib/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const cfg = getConfig();
  transporter = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.password },
  });
  return transporter;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendMail(to: string, subject: string, html: string): Promise<SendResult> {
  const cfg = getConfig();
  if (!isMailConfigured(cfg)) return { ok: false, error: 'SMTP chưa cấu hình' };
  try {
    await getTransporter().sendMail({ from: cfg.smtp.from, to, subject, html });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'lỗi gửi' };
  }
}

/** Cảnh báo admin (best-effort, không throw). */
export async function sendAlert(subject: string, message: string): Promise<void> {
  const cfg = getConfig();
  const to = cfg.smtp.alertTo || cfg.adminEmail;
  if (!to || !isMailConfigured(cfg)) {
    log.warn('alert.skip', { reason: 'mail-not-configured' });
    return;
  }
  const r = await sendMail(to, `[Bản tin] ${subject}`, `<pre>${message}</pre>`);
  if (!r.ok) log.error('alert.fail', { error: r.error });
}

/** Cho phép test tiêm transporter giả. */
export function __setTransporterForTest(t: Transporter | null): void {
  transporter = t;
}
