import { SocialNetwork } from './ep-types';

/* ═══════════ СОЦИАЛЬНЫЕ СЕТИ: МЕТАДАННЫЕ И ВАЛИДАЦИЯ ═══════════ */

export interface SocialNetworkMeta {
  key: SocialNetwork;
  /** Название в интерфейсе */
  label: string;
  /** CSS-класс иконки Font Awesome (для MAX — свой бейдж с буквой) */
  iconClass: string | null;
  /** Буква/символ для бейджа, если иконки нет */
  badgeText?: string;
  /** Фирменный цвет сети */
  color: string;
  /** Подсказка в поле ввода */
  placeholder: string;
  /** Текст ошибки с примером корректной ссылки */
  errorHint: string;
  /** Шаблон валидации (без схемы, с optional https://) */
  pattern: RegExp;
}

export const SOCIAL_NETWORKS: SocialNetworkMeta[] = [
  {
    key: 'vk',
    label: 'ВКонтакте',
    iconClass: 'fa-brands fa-vk',
    badgeText: undefined,
    color: '#0077ff',
    placeholder: 'https://vk.com/username',
    errorHint: 'Некорректная ссылка ВКонтакте. Пример: https://vk.com/username',
    // vk.com, m.vk.com, www.vk.com, vkontakte.ru + непустой путь
    pattern: /^(https?:\/\/)?((m|www)\.)?(vk\.com|vkontakte\.ru)\/[A-Za-z0-9_\-.]+(\/[A-Za-z0-9_\-.?#=]*)*\/?$/i,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    iconClass: 'fa-brands fa-telegram',
    badgeText: undefined,
    color: '#2aabee',
    placeholder: 'https://t.me/username',
    errorHint: 'Некорректная ссылка Telegram. Пример: https://t.me/username',
    // t.me/username (3+ символов: буквы, цифры, _), инвайт-ссылки t.me/+hash
    pattern: /^(https?:\/\/)?(t\.me|telegram\.me)\/(\+[A-Za-z0-9_-]{6,}|[A-Za-z0-9_]{3,})\/?$/i,
  },
  {
    key: 'max',
    label: 'MAX',
    iconClass: null,
    badgeText: 'M',
    color: '#8b7cf6',
    placeholder: 'https://max.ru/u/123456789',
    errorHint: 'Некорректная ссылка MAX. Пример: https://max.ru/u/123456789',
    // max.ru + непустой путь (профиль /u/..., пригласительные и т.п.)
    pattern: /^(https?:\/\/)?((www)\.)?max\.ru\/[A-Za-z0-9_\-.]+(\/[A-Za-z0-9_\-.?#=]*)*\/?$/i,
  },
];

export function socialMeta(key: SocialNetwork): SocialNetworkMeta {
  return SOCIAL_NETWORKS.find(n => n.key === key)!;
}

/** Короткий вид ссылки для отображения на карточке: без схемы https:// */
export function shortSocialUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * Валидация и нормализация ссылки на аккаунт соцсети.
 * Возвращает нормализованный URL (с https://) или ошибку.
 */
export function validateSocialUrl(
  key: SocialNetwork,
  raw: string
): { ok: true; url: string } | { ok: false; error: string } {
  const meta = socialMeta(key);
  const value = raw.trim();

  if (!value) {
    return { ok: false, error: 'Введите ссылку на аккаунт' };
  }
  if (/\s/.test(value)) {
    return { ok: false, error: meta.errorHint };
  }

  // Нормализуем: добавляем https://, если схема не указана
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  if (!meta.pattern.test(normalized)) {
    return { ok: false, error: meta.errorHint };
  }
  return { ok: true, url: normalized };
}
