import { NextResponse } from 'next/server';
import { audit, getEffectiveUser, isAdminRoles, isValidEmail, normalizeEmail } from '@/lib/ep-server-auth';
import { isMailConfigured, mailConfigInfo, sendMail, simpleMailHtml } from '@/lib/mailer';

/**
 * Почта: статус конфигурации и тестовая отправка (только для админов).
 * Этап 1 — проверка того, что почтовый шлюз работает, до подключения
 * основных сценариев (приглашения, напоминания).
 *
 *  GET  — статус: настроена ли почта и от кого будут уходить письма;
 *  POST — отправить тестовое письмо (по умолчанию — на почту запросившего).
 */

export async function GET() {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  const cfg = mailConfigInfo();
  return NextResponse.json({
    configured: isMailConfigured(),
    host: cfg.host,
    port: cfg.port,
    from: cfg.from || null,
  });
}

export async function POST(req: Request) {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  if (!isMailConfigured())
    return NextResponse.json(
      { ok: false, error: 'Почта не настроена — заполните SMTP_USER и SMTP_PASS в .env (пароль приложения Яндекса)' },
      { status: 400 }
    );

  const body = await req.json().catch(() => null);
  const to = normalizeEmail(String(body?.to ?? eff.actor.email));
  if (!isValidEmail(to))
    return NextResponse.json({ ok: false, error: 'Введите корректный email' }, { status: 400 });

  const result = await sendMail({
    to,
    subject: 'EnglishPro — тестовое письмо',
    text:
      'Это тестовое письмо почтового шлюза EnglishPro.\n' +
      'Если вы его получили — отправка почты настроена правильно.',
    html: simpleMailHtml('Почта работает', [
      'Это тестовое письмо почтового шлюза <b>EnglishPro</b>.',
      'Если вы его получили — отправка почты настроена правильно, и следующие этапы (пароль на почту при создании аккаунта, напоминания о занятиях) смогут доставлять уведомления.',
    ]),
  });

  await audit({ id: eff.actor.id, email: eff.actor.email }, 'MAIL_TEST', { email: to }, {
    ok: result.ok,
    error: result.ok ? undefined : result.error,
  });

  if (!result.ok)
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
