// Разовая миграция: заполнить User.roles (JSON-набор) вместо удалённой колонки role.
// Ожидание: после db push все пользователи получили дефолт ["TEACHER"];
// владелец (MAIN_ADMIN) определяется по email из scripts/setup-main-admin.mjs.
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';

const db = new PrismaClient();

// MAIN_ADMINemail берём из env MAIN_ADMIN_EMAIL или из .env файла
function mainAdminEmail() {
  if (process.env.MAIN_ADMIN_EMAIL) return process.env.MAIN_ADMIN_EMAIL.trim().toLowerCase();
  try {
    const envPath = '/home/z/my-project/.env';
    if (existsSync(envPath)) {
      const m = readFileSync(envPath, 'utf8').match(/^MAIN_ADMIN_EMAIL=(.+)$/m);
      if (m) return m[1].trim().toLowerCase();
    }
  } catch {}
  return 'thomasage@yandex.ru';
}

const mainEmail = mainAdminEmail();
const users = await db.user.findMany({ select: { id: true, email: true, roles: true } });
for (const u of users) {
  const roles = u.email === mainEmail ? ['MAIN_ADMIN'] : ['TEACHER'];
  await db.user.update({ where: { id: u.id }, data: { roles: JSON.stringify(roles) } });
  console.log(`${u.email}: ${u.roles} -> ${JSON.stringify(roles)}`);
}
console.log('MAIN_ADMIN_EMAIL =', mainEmail);
await db.$disconnect();
