'use client';

import { ROLE_LABELS, UserRole } from '@/lib/ep-types';

/**
 * Цветные этикетки ролей. У аккаунта может быть несколько ролей
 * (учитель + админ) — показываем все: порядок «главный админ → админ → учитель».
 */

export const ROLE_COLORS: Record<string, string> = {
  MAIN_ADMIN: '#00e5a0',
  ADMIN: '#ffb400',
  TEACHER: '#8b93a7',
};

const ROLE_ORDER: UserRole[] = ['MAIN_ADMIN', 'ADMIN', 'TEACHER'];

export function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] || '#8b93a7';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
      style={{ background: `${color}1f`, color, border: `1px solid ${color}40` }}
    >
      {ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}
    </span>
  );
}

/** Набор этикеток всех ролей аккаунта */
export function RoleBadges({ roles }: { roles: string[] }) {
  const sorted = ROLE_ORDER.filter(r => roles.includes(r));
  if (sorted.length === 0) return <RoleBadge role="TEACHER" />;
  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0 flex-wrap">
      {sorted.map(r => (
        <RoleBadge key={r} role={r} />
      ))}
    </span>
  );
}
