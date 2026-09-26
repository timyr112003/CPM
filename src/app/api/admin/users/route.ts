import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { sendMail, simpleMailHtml } from '@/lib/mailer';
import {
  audit,
  getEffectiveUser,
  hashPassword,
  isAdminRoles,
  isValidEmail,
  normalizeEmail,
  parseRoles,
  publicUser,
  ROLE_ADMIN,
  ROLE_MAIN_ADMIN,
  ROLE_TEACHER,
  STATUS_ACTIVE,
} from '@/lib/ep-server-auth';

/** Алфавит без похожих символов (0/O, 1/l/I) — для сгенерированных паролей */
const PWD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += PWD_ALPHABET[bytes[i] % PWD_ALPHABET.length];
  return out;
}

const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );

const APP_URL = (process.env.APP_URL || '').trim();

/** Список аккаунтов (только для админов) */
export async function GET() {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  const rows = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      photo: true,
      roles: true,
      status: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  // Порядок: по старшинству роли (главный админ → админы → учителя);
  // активные раньше архивных; внутри — по имени
  const roleRank = (rolesRaw: string): number => {
    const roles = parseRoles(rolesRaw);
    if (roles.includes(ROLE_MAIN_ADMIN)) return 0;
    if (roles.includes(ROLE_ADMIN)) return 1;
    return 2;
  };
  const users = rows
    .map(r => ({ ...r, parsedRoles: parseRoles(r.roles) }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === STATUS_ACTIVE ? -1 : 1;
      const r = roleRank(a.roles) - roleRank(b.roles);
      if (r !== 0) return r;
      return a.name.localeCompare(b.name, 'ru');
    })
    .map(({ parsedRoles: _parsedRoles, ...r }) => ({ ...r, roles: _parsedRoles }));

  return NextResponse.json({ users });
}

/**
 * Создание аккаунта администратором.
 * Один аккаунт — один набор ролей: ["TEACHER"], ["ADMIN"] или ["ADMIN","TEACHER"]
 * (гибрид: два кабинета, один пароль). MAIN_ADMIN через API не создаётся,
 * почта уникальна.
 *
 * Два режима пароля:
 *  - sendByEmail: true — сервер сам генерирует временный пароль, сохраняет хеш
 *    и высылает приглашение на указанную почту; при первом входе обязателен
 *    сброс (mustChangePassword). Сам пароль в ответе НЕ возвращается.
 *    Если письмо отправить не удалось — аккаунт всё равно создаётся, а пароль
 *    возвращается ОДИН раз (oneTimePassword), чтобы админ передал его вручную.
 *  - без sendByEmail — прежний режим: админ задаёт пароль сам.
 */
export async function POST(req: Request) {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const email = normalizeEmail(String(body?.email ?? ''));
  const sendByEmail = body?.sendByEmail === true;
  const password = sendByEmail ? generateTempPassword() : String(body?.password ?? '');
  const rawRoles = Array.isArray(body?.roles) ? body.roles : [body?.role ?? ROLE_TEACHER];

  if (!name) return NextResponse.json({ error: 'Укажите имя' }, { status: 400 });
  if (!isValidEmail(email))
    return NextResponse.json({ error: 'Введите корректный email' }, { status: 400 });
  if (!sendByEmail && password.length < 4)
    return NextResponse.json({ error: 'Пароль должен быть не менее 4 символов' }, { status: 400 });

  // Валидация набора ролей: TEACHER и/или ADMIN, без MAIN_ADMIN, без пустых
  const roles: string[] = [];
  for (const r of rawRoles) {
    if (r === ROLE_TEACHER || r === ROLE_ADMIN) {
      if (!roles.includes(r)) roles.push(r);
    } else if (r === ROLE_MAIN_ADMIN) {
      return NextResponse.json({ error: 'Главного администратора нельзя создать через API' }, { status: 400 });
    }
  }
  if (roles.length === 0)
    return NextResponse.json({ error: 'Выберите хотя бы одну роль' }, { status: 400 });
  if (roles.includes(ROLE_ADMIN) && eff.actor.roles.includes(ROLE_MAIN_ADMIN) === false)
    return NextResponse.json(
      { error: 'Только главный администратор может создавать администраторов' },
      { status: 403 }
    );

  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        roles: JSON.stringify(roles),
        status: STATUS_ACTIVE,
        mustChangePassword: true, // временный пароль от админа — сменить при первом входе
      },
    });

    await audit(
      { id: eff.actor.id, email: eff.actor.email },
      'USER_CREATED',
      { id: user.id, email: user.email },
      { roles, inviteByEmail: sendByEmail }
    );

    if (sendByEmail) {
      const mail = await sendMail({
        to: email,
        subject: 'EnglishPro — ваш аккаунт создан',
        text:
          `Здравствуйте, ${name}!\n\n` +
          `Для вас создан аккаунт в приложении EnglishPro.\n` +
          `Логин: ${email}\n` +
          `Временный пароль: ${password}\n\n` +
          (APP_URL ? `Войти: ${APP_URL}\n\n` : '') +
          'Войдите с этим паролем — приложение сразу попросит придумать новый.',
        html: simpleMailHtml('Ваш аккаунт создан', [
          `Здравствуйте, <b>${escHtml(name)}</b>!`,
          'Для вас создан аккаунт в приложении EnglishPro.',
          `Логин: <b>${escHtml(email)}</b>`,
          `Временный пароль: <b style="font-size:16px;letter-spacing:1px">${password}</b>`,
          APP_URL ? `Войти: <a href="${escHtml(APP_URL)}">${escHtml(APP_URL)}</a>` : 'Откройте приложение EnglishPro и войдите с этим паролем.',
          'При первом входе приложение попросит придумать новый пароль.',
        ]),
      });

      await audit(
        { id: eff.actor.id, email: eff.actor.email },
        'INVITE_SENT',
        { id: user.id, email: user.email },
        { ok: mail.ok, error: mail.ok ? undefined : mail.error }
      );

      if (mail.ok) return NextResponse.json({ user: publicUser(user), emailSent: true });
      // Письмо не ушло — отдаём пароль ОДИН раз, чтобы админ передал его вручную
      return NextResponse.json({
        user: publicUser(user),
        emailSent: false,
        emailError: mail.error,
        oneTimePassword: password,
      });
    }

    return NextResponse.json({ user: publicUser(user) });
  } catch (e) {
    // P2002 — уникальный email: такая почта уже занята
    if ((e as { code?: string })?.code === 'P2002')
      return NextResponse.json(
        { error: 'Эта почта уже используется — у одного человека один аккаунт' },
        { status: 409 }
      );
    throw e;
  }
}
