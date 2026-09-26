import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

/**
 * Серверная авторизация EnglishPro:
 *  - пароли хранятся в БД только в виде scrypt-хеша (salt:hash);
 *  - сессии — случайный токен в SQLite + httpOnly cookie «ep_session»;
 *  - роли — НАБОР у одного аккаунта: TEACHER (учительский кабинет) и/или
 *    ADMIN (административный кабинет); MAIN_ADMIN — владелец;
 *    один логин/пароль, кабинет выбирается после входа и переключается
 *    внутри аккаунта без повторной авторизации;
 *  - режим управления аккаунтом (имперсонация) — httpOnly cookie «ep_view_as»
 *    поверх своей сессии, проверяется на каждом запросе;
 *  - cookie работает и через интернет (https-превью), и на localhost.
 */

export const ROLE_MAIN_ADMIN = 'MAIN_ADMIN';
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_TEACHER = 'TEACHER';
export const STATUS_ACTIVE = 'ACTIVE';
export const STATUS_DISABLED = 'DISABLED';

export type Role = 'MAIN_ADMIN' | 'ADMIN' | 'TEACHER';

const SESSION_COOKIE = 'ep_session';
const VIEW_COOKIE = 'ep_view_as';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней
const VIEW_TTL_SEC = 8 * 60 * 60; // режим управления не живёт дольше 8 часов

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  roles: Role[];
  status: string;
  mustChangePassword: boolean;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  try {
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  roles: string;
  status: string;
  mustChangePassword: boolean;
};

/** Разбор JSON-набора ролей из БД: невалидные значения отбрасываются,
 *  пустой/битый набор → учитель (безопасный дефолт) */
export function parseRoles(raw: string | null | undefined): Role[] {
  try {
    const arr = JSON.parse(String(raw || '[]')) as unknown;
    if (!Array.isArray(arr)) return [ROLE_TEACHER];
    const valid = arr.filter(
      (r): r is Role => r === ROLE_MAIN_ADMIN || r === ROLE_ADMIN || r === ROLE_TEACHER
    );
    return valid.length ? valid : [ROLE_TEACHER];
  } catch {
    return [ROLE_TEACHER];
  }
}

export function publicUser(u: UserRow): SessionUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    photo: u.photo,
    roles: parseRoles(u.roles),
    status: u.status || STATUS_ACTIVE,
    mustChangePassword: !!u.mustChangePassword,
  };
}

/** Есть ли в наборе ролей админ-доступ (ADMIN или MAIN_ADMIN) */
export function isAdminRoles(roles: string[]): boolean {
  return roles.includes(ROLE_MAIN_ADMIN) || roles.includes(ROLE_ADMIN);
}

/**
 * Может ли actor управлять аккаунтом target:
 *  - главный админ управляет всеми, кроме самого себя (через админ-панель)
 *    и других главных админов (их и не может быть больше одного);
 *  - младший админ управляет только чистыми учителями — аккаунты с
 *    админ-правами (в т.ч. гибриды «админ+учитель») он не трогает;
 *  - учитель не управляет никем.
 */
export function canManage(
  actor: Pick<SessionUser, 'id'> & { roles: string[] },
  target: Pick<SessionUser, 'id'> & { roles: string[] }
): boolean {
  if (actor.id === target.id) return false;
  if (actor.roles.includes(ROLE_MAIN_ADMIN))
    return !target.roles.includes(ROLE_MAIN_ADMIN);
  if (actor.roles.includes(ROLE_ADMIN))
    return target.roles.length === 1 && target.roles[0] === ROLE_TEACHER;
  return false;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await db.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === 'production',
  });
}

/** Читает сессию и возвращает пользователя (актора). Аккаунт должен быть активен. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await db.session.findUnique({ where: { token }, include: { user: true } });
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      await db.session.delete({ where: { token } }).catch(() => {});
      return null;
    }
    if (session.user.status !== STATUS_ACTIVE) return null; // архивирован — сессия недействительна
    return publicUser(session.user);
  } catch (e) {
    console.error('getSessionUser error', e);
    return null;
  }
}

/** Включить режим управления аккаунтом target (имперсонация) */
export async function setViewAs(targetUserId: string): Promise<void> {
  const jar = await cookies();
  jar.set(VIEW_COOKIE, targetUserId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: VIEW_TTL_SEC,
    secure: process.env.NODE_ENV === 'production',
  });
}

/** Выйти из режима управления (если он был включён) */
export async function clearViewAs(): Promise<void> {
  const jar = await cookies();
  if (!jar.get(VIEW_COOKIE)?.value) return;
  jar.set(VIEW_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export interface EffectiveContext {
  /** Кто вошёл в систему (админ в режиме управления) */
  actor: SessionUser;
  /** Чей аккаунт фактически используется (при имперсонации — учитель) */
  user: SessionUser;
  impersonating: boolean;
}

/**
 * Эффективный пользователь запроса: своя сессия + (опционально) режим управления.
 * Кука ep_view_as проверяется на КАЖДЫЙ запрос: права и статус перепроверяются,
 * поэтому архивация аккаунта или разжалование админа действует мгновенно.
 * Невалидная/устаревшая кука просмотра молча игнорируется.
 */
export async function getEffectiveUser(): Promise<EffectiveContext | null> {
  const actor = await getSessionUser();
  if (!actor) return null;
  try {
    const jar = await cookies();
    const viewId = jar.get(VIEW_COOKIE)?.value;
    if (!viewId || viewId === actor.id) return { actor, user: actor, impersonating: false };
    const target = await db.user.findUnique({ where: { id: viewId } });
    if (
      !target ||
      target.status !== STATUS_ACTIVE ||
      !canManage(actor, { id: target.id, roles: parseRoles(target.roles) })
    ) {
      return { actor, user: actor, impersonating: false };
    }
    return { actor, user: publicUser(target), impersonating: true };
  } catch (e) {
    console.error('getEffectiveUser error', e);
    return { actor, user: actor, impersonating: false };
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.delete({ where: { token } }).catch(() => {});
  jar.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  jar.set(VIEW_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

/** Запись в журнал аудита. Никогда не бросает исключение. */
export async function audit(
  actor: { id?: string | null; email?: string | null } | null,
  action: string,
  target?: { id?: string | null; email?: string | null } | null,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        action,
        targetId: target?.id ?? null,
        targetEmail: target?.email ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch (e) {
    console.error('audit error', e);
  }
}

/** Отозвать все сессии пользователя (при архивации/сбросе пароля) */
export async function revokeUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } }).catch(() => {});
}
