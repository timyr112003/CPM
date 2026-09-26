import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Почтовый шлюз EnglishPro (этап 1 — инфраструктура).
 *
 * Единая точка отправки писем для всех почтовых сценариев:
 * приглашения аккаунтам, напоминания о занятиях, квитанции и т.д.
 *
 * Принципы:
 *  - креды ТОЛЬКО в переменных окружения (SMTP_HOST/PORT/USER/PASS, MAIL_FROM),
 *    в коде, логах и ответах API их нет;
 *  - письмо никогда не ломает основную операцию: sendMail возвращает
 *    {ok:true,...} | {ok:false,error}, а не бросает исключение;
 *  - транспорт создаётся лениво и пересоздаётся после сбоя;
 *  - смена провайдера (Яндекс SMTP → сервис рассылок) = правка переменных
 *    окружения, код не меняется.
 *
 * Настройка (Яндекс): включить 2FA → id.yandex.ru → Безопасность →
 * Пароли приложений → создать пароль для почты → вставить в SMTP_PASS.
 */

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.yandex.ru';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || (SMTP_USER ? `EnglishPro <${SMTP_USER}>` : '');

/** Почта настроена: есть и отправитель, и пароль приложения */
export function isMailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

/** Публичные сведения о конфигурации (без секретов) — для статуса в UI */
export function mailConfigInfo(): { host: string; port: number; user: string; from: string } {
  return { host: SMTP_HOST, port: SMTP_PORT, user: SMTP_USER, from: MAIL_FROM };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 — SSL, 587 — STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export type MailResult = { ok: true; messageId: string } | { ok: false; error: string };

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Отправить письмо. Никогда не бросает исключение. */
export async function sendMail(payload: MailPayload): Promise<MailResult> {
  if (!isMailConfigured()) {
    return { ok: false, error: 'Почта не настроена — заполните SMTP_USER и SMTP_PASS в .env' };
  }
  try {
    const info = await getTransporter().sendMail({
      from: MAIL_FROM || SMTP_USER,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    console.log('[mailer] письмо отправлено:', { to: payload.to, subject: payload.subject, messageId: info.messageId });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[mailer] ошибка отправки:', { to: payload.to, subject: payload.subject, error });
    transporter = null; // транспорт мог «протухнуть» — пересоздадим при следующей отправке
    return { ok: false, error };
  }
}

/**
 * Фирменный HTML-каркас письма: заголовок + блоки + подпись.
 * Блоки вставляются «как есть» — каждый блок сам отвечает за свою разметку
 * (<p>, <table>, ...). Нужен для писем с таблицами (напоминания о занятиях);
 * простой случай абзацев — simpleMailHtml ниже.
 */
export function framedMailHtml(heading: string, blocks: string[]): string {
  const body = blocks.join('\n');
  return `\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#5b6cf0;padding:16px 24px">
    <span style="color:#ffffff;font-size:18px;font-weight:bold">EnglishPro</span>
  </div>
  <div style="padding:24px;color:#1f2937;font-size:14px">
    <h2 style="margin:0 0 16px;font-size:17px">${heading}</h2>
    ${body}
    <p style="margin:16px 0 0;color:#6b7280;font-size:12px">Это автоматическое письмо приложения EnglishPro. Если оно пришло вам по ошибке — просто проигнорируйте его.</p>
  </div>
</div>`;
}

/**
 * Простой фирменный HTML-каркас письма (заголовок + абзацы + подпись).
 * Используется тестовым письмом, приглашениями аккаунтов (этап 2).
 */
export function simpleMailHtml(heading: string, paragraphs: string[]): string {
  return framedMailHtml(heading, paragraphs.map(p => `<p style="margin:0 0 12px;line-height:1.5">${p}</p>`));
}
