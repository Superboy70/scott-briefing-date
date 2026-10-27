// 빌드: src/ 여러 파일 → 한 파일로 합침.
//   web/index.html (+ sw.js·manifest·icon) = 배포판(Cloudflare Pages 출력 폴더 web)
//   dist/artifact.html                     = Claude 아티팩트판(머리 부분 없이 본문만, 서비스 워커 없음)
// 버전은 VERSION 파일 하나에서 게임·sw.js 캐시 이름에 같이 들어간다(손으로 맞추지 않음).
// 실행: node tools/build.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const VERSION = rd('VERSION').trim();
const TITLE = '부품함 정리';
const FONTS = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Mono:wght@600&family=IBM+Plex+Sans+KR:wght@400;700&display=swap';

const css = rd('src/style.css');
const body = rd('src/body.html');
const levels = JSON.parse(rd('src/levels.json')).map(({ n, kind, empties, start, opt }) => ({ n, kind, empties, start, opt }));
const scripts = [
  `<script>var APP_VERSION=${JSON.stringify(VERSION)};var LEVELS=${JSON.stringify(levels)};</script>`,
  `<script>\n${rd('src/core.js')}</script>`,
  `<script>\n${rd('src/game.js')}</script>`,
].join('\n');

const web = `<!doctype html>
<html lang="ko" class="web">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="theme-color" content="#1c2a2f">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${FONTS}">
<style>
${css}</style>
</head>
<body>
${body}
${scripts}
<script>if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');</script>
</body>
</html>
`;

const artifact = `<title>${TITLE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${FONTS}">
<style>
${css}</style>
${body}
${scripts}
`;

// 오프라인 캐시: 페이지는 네트워크 우선(업데이트가 바로 보이게), 실패하면 캐시
const sw = `const CACHE = 'parts-sort-${VERSION}';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
`;

const manifest = JSON.stringify({
  name: TITLE, short_name: TITLE, lang: 'ko', start_url: './', display: 'standalone', orientation: 'portrait',
  background_color: '#1c2a2f', theme_color: '#1c2a2f',
  icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
}, null, 2);

// 아이콘: 매트 위 저항 하나
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1c2a2f"/><rect x="40" y="248" width="432" height="16" rx="8" fill="#b9c4c8"/><rect x="128" y="186" width="256" height="140" rx="70" fill="#d6b88a"/><rect x="176" y="186" width="34" height="140" fill="#d93a2f"/><rect x="238" y="186" width="34" height="140" fill="#8b4bc9"/><rect x="300" y="186" width="34" height="140" fill="#ef7d1a"/></svg>`;

fs.mkdirSync(path.join(root, 'web'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'web/index.html'), web);
fs.writeFileSync(path.join(root, 'web/sw.js'), sw);
fs.writeFileSync(path.join(root, 'web/manifest.webmanifest'), manifest + '\n');
fs.writeFileSync(path.join(root, 'web/icon.svg'), icon + '\n');
fs.writeFileSync(path.join(root, 'dist/artifact.html'), artifact);
console.log(`빌드 v${VERSION}: web/index.html ${(web.length / 1024).toFixed(0)}KB · dist/artifact.html ${(artifact.length / 1024).toFixed(0)}KB`);
