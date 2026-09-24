// 아이콘 PNG 생성: node assets/make-icons.mjs (playwright 필요)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function shot(size, out, pad = 0, bg = '#1a0a14', round = false) {
  const inner = size - pad * 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${round ? 'transparent' : bg}">
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${round ? `border-radius:50%;overflow:hidden;background:${bg}` : ''}">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: round });
}
const www = join(here, '..', 'www', 'icons');
await shot(192, join(www, 'icon-192.png'));
await shot(512, join(www, 'icon-512.png'));
const res = join(here, '..', 'android-res');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, m] of Object.entries(dens)) {
  await shot(48 * m, join(res, `mipmap-${d}`, 'ic_launcher.png'));
  await shot(48 * m, join(res, `mipmap-${d}`, 'ic_launcher_round.png'), 0, '#1a0a14', true);
  // 적응형 아이콘 전경 (108dp, 안전영역 72dp)
  await shot(108 * m, join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'), 18 * m);
}
await browser.close();
console.log('icons done');
