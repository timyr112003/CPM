/**
 * Бэкап базы данных EnglishPro.
 *
 * Запуск:  npm run backup            (или: node scripts/backup-db.mjs)
 *  - Consistent-снимок через SQLite «VACUUM INTO» — безопасно при работающем сервере;
 *  - если VACUUM INTO недоступен — обычное копирование файла (fallback);
 *  - копии складываются в папку backups/, хранятся последние N (BACKUP_KEEP, по умолчанию 30);
 *  - восстановление вручную: остановить сервер и заменить db/custom.db нужной копией.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

function resolveDbPath() {
  const envUrl = String(process.env.DATABASE_URL || '');
  if (envUrl.startsWith('file:')) {
    const p = envUrl.slice('file:'.length);
    if (path.isAbsolute(p) && fs.existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), 'db', 'custom.db');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp(d = new Date()) {
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function main() {
  const src = resolveDbPath();
  if (!fs.existsSync(src)) {
    console.error('БД не найдена: ' + src + ' (сначала выполните npm run setup)');
    process.exit(1);
  }

  const dir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'englishpro-' + stamp() + '.db');

  let mode = 'VACUUM INTO (consistent snapshot)';
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } catch (e) {
    mode = 'копирование файла (fallback: ' + String(e.message || e).split('\n')[0] + ')';
    fs.copyFileSync(src, dest);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  // Retention: хранить последние BACKUP_KEEP копий
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 30));
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('englishpro-') && f.endsWith('.db'))
    .sort();
  const removed = files.slice(0, Math.max(0, files.length - keep));
  for (const f of removed) {
    try {
      fs.unlinkSync(path.join(dir, f));
    } catch {
      /* ignore */
    }
  }

  const size = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log('Бэкап создан: ' + dest + ' (' + size + ' КБ, режим: ' + mode + ')');
  console.log('Копий в backups/: ' + (files.length - removed.length) + ' (лимит ' + keep + ')');
}

main().catch((e) => {
  console.error('Ошибка бэкапа:', (e && e.message) || e);
  process.exit(1);
});
