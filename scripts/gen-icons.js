/**
 * Генерация PWA-иконок EnglishPro (public/icons/).
 * Запуск: bun scripts/gen-icons.js
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#080b12"/>
  <rect x="16" y="16" width="480" height="480" rx="96" fill="none" stroke="#00e5a0" stroke-opacity="0.25" stroke-width="8"/>
  <circle cx="256" cy="256" r="168" fill="none" stroke="#00e5a0" stroke-width="22" stroke-opacity="0.9"/>
  <text x="256" y="262" text-anchor="middle" dominant-baseline="central"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="168" font-weight="bold" fill="#00e5a0">EP</text>
</svg>`;

mkdirSync('public/icons', { recursive: true });

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`icon-${size}.png done`);
}

// maskable-вариант: больше внутренние отступы под круглую маску Android
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#080b12"/>
  <circle cx="256" cy="256" r="132" fill="none" stroke="#00e5a0" stroke-width="18" stroke-opacity="0.9"/>
  <text x="256" y="262" text-anchor="middle" dominant-baseline="central"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="132" font-weight="bold" fill="#00e5a0">EP</text>
</svg>`;

await sharp(Buffer.from(svgMaskable))
  .resize(512, 512)
  .png()
  .toFile('public/icons/icon-maskable-512.png');
console.log('icon-maskable-512.png done');
