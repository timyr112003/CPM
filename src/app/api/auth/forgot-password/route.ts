import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { sendMail, simpleMailHtml } from '@/lib/mailer';
import { audit, normalizeEmail, STATUS_ACTIVE } from '@/lib/ep-server-auth';

/**
 * «Забыли пароль?» — шаг 1: запрос письма со ссылкой для восстановления.
 *
 * Принципы безопасности:
 *  - ответ ВСЕГДА { ok: true }, существует аккаунт с такой почтой или нет:
 *    роут не раскрывает, какие адреса зарегистрированы;
 *  - одноразовый токен энтропией 256 бит; в БД хранится только его sha256-хеш
 *    (утечка дампа не позволяет восстановить ссылки);
 *  - ссылка живёт 60 минут, использованный токен повторно не принимается
 *    (см. /api/auth/reset-password);
 *  - новый запрос письма аннулирует предыдущие токены этого аккаунта;
 *  - ограничение частоты: не больше 3 писем на адрес за 15 минут.
 *
 * Шаг 2 — установка нового пароля: POST /api/auth/reset-password.
 */

export const dynamic = 'force-dynamic';

const TOKEN_TTL_MS = 60 * 60 * 1000; // ссылка живёт 60 минут
const RATE_LIMIT = 3; // писем на адрес
const RATE_WINDOW_MS = 15 * 60 * 1000;

/** Простейший in-memory лимитер (процесс-локальный: для одного инстанса достаточно) */
const rateMap = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    rateMap.set(key, hits);
    return true;
  }
  hits.push(now);
  rateMap.set(key, hits);
  return false;
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );

/** Базовый адрес приложения: APP_URL из .env или origin текущего запроса */
function appOrigin(req: Request): string {
  const fromEnv = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(String(body?.email ?? ''));

    // Формат почты проверяем, но наружу об ошибках валидации не сообщаем:
    // одинаковый ответ не даёт перебором выяснять, какие адреса существуют
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: true });
    }
    if (rateLimited(email)) {
      // Лимит не отличим от успеха — частые запросы просто не шлют письмо
      return NextResponse.json({ ok: true });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.status !== STATUS_ACTIVE) {
      return NextResponse.json({ ok: true });
    }

    // Новый запрос аннулирует прежние неиспользованные токены аккаунта
    await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const token = randomBytes(32).toString('base64url');
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const link = `${appOrigin(req)}/?reset=${token}`;
    const minutes = Math.round(TOKEN_TTL_MS / 60000);

    const mail = await sendMail({
      to: user.email,
      subject: 'EnglishPro — восстановление пароля',
      text:
        `Здравствуйте, ${user.name}!\n\n` +
        `Кто-то запросил восстановление пароля для аккаунта ${user.email}.\n` +
        `Чтобы задать новый пароль, откройте ссылку (живёт ${minutes} минут):\n` +
        `${link}\n\n` +
        `Если вы не запрашивали восстановление — просто проигнорируйте это письмо, пароль останется прежним.`,
      html: simpleMailHtml('Восстановление пароля', [
        `Здравствуйте, <b>${escHtml(user.name)}</b>!`,
        `Кто-то запросил восстановление пароля для аккаунта <b>${escHtml(user.email)}</b>.`,
        `Нажмите кнопку, чтобы задать новый пароль. Ссылка действует <b>${minutes} минут</b> и сработает один раз.`,
        `<a href="${escHtml(link)}" style="display:inline-block;background:#5b6cf0;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;margin:4px 0 8px">Задать новый пароль</a>`,
        `Если кнопка не сработала, скопируйте ссылку в браузер:<br><span style="word-break:break-all;color:#6b7280">${escHtml(link)}</span>`,
        'Если вы не запрашивали восстановление — просто проигнорируйте это письмо, пароль останется прежним.',
      ]),
    });

    await audit(null, 'PASSWORD_RESET_REQUESTED', { id: user.id, email: user.email }, {
      ok: mail.ok,
      error: mail.ok ? undefined : mail.error,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('forgot-password error', e);
    // Даже при сбое отвечаем «успешно»: цель роута — не раскрывать сведения об аккаунтах
    return NextResponse.json({ ok: true });
  }
}
