// 배포 전 자동 점검(1분 안). 통과해야 푸시한다.
//   버전 일치 · 오류 0 · 1레벨을 해답대로 눌러 깸 · 옛 저장 열림 · 폰 화면에서 칸이 안 넘침 · 아티팩트판 오류 0
// 실행: node tools/build.js && node tools/smoke.js [--shots]  (스크린샷은 tools/out/)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const VERSION = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const SHOTS = process.argv.includes('--shots');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? '○' : '✕'} ${msg}`); if (!ok) fails.push(msg); };

function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, () => ok(srv)));
}

async function openPage(browser, url, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 }, opts));
  const page = await ctx.newPage();
  const errors = [];
  await page.route((u) => !u.href.startsWith(new URL(url).origin), (r) => r.abort()); // 바깥 요청(글꼴 등)은 막음
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.level);
  return { ctx, page, errors };
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  if (SHOTS) fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  try {
    const sw = fs.readFileSync(path.join(root, 'web/sw.js'), 'utf8');
    check(sw.includes(`'parts-sort-${VERSION}'`), `sw.js 캐시 이름 = 버전 ${VERSION}`);

    // 1레벨: 해답대로 눌러서 깨는지
    let { ctx, page, errors } = await openPage(browser, `${base}/web/index.html?mute=1`);
    check(await page.evaluate((v) => window.__game.version === v, VERSION), '게임 APP_VERSION = VERSION');
    const sol = await page.evaluate(() => window.__game.solution());
    for (const [i, j] of sol) {
      await page.click(`.bin[data-i="${i}"]`);
      await page.click(`.bin[data-i="${j}"]`);
      await page.waitForFunction(() => !document.querySelector('.bin.sel'), null, { timeout: 2000 });
      await page.waitForTimeout(320);
    }
    await page.waitForFunction(() => window.__game.won(), null, { timeout: 3000 }).catch(() => {});
    check(await page.evaluate(() => window.__game.won()), `1레벨을 해답 ${sol.length}수로 눌러 깸`);
    if (SHOTS) await page.screenshot({ path: path.join(__dirname, 'out/win.png') });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('partsSort.save.v1')));
    check(saved && saved.unlocked === 2 && saved.best[1] === sol.length, '깬 기록 저장(다음 레벨 열림·최고 수)');
    check(!errors.length, `오류 0 (${errors.join(' | ') || '없음'})`);
    await ctx.close();

    // 옛 저장 불러오기
    const saves = path.join(__dirname, 'smoke/saves');
    for (const f of fs.readdirSync(saves)) {
      const raw = fs.readFileSync(path.join(saves, f), 'utf8');
      const exp = JSON.parse(raw).unlocked;
      ({ ctx, page, errors } = await openPage(browser, `${base}/web/index.html?mute=1`, {}));
      await page.evaluate((r) => localStorage.setItem('partsSort.save.v1', r), raw);
      await page.reload();
      await page.waitForFunction(() => window.__game && window.__game.level);
      check(await page.evaluate((e) => window.__game.level === e, exp) && !errors.length, `옛 저장 ${f} → 레벨 ${exp}에서 시작`);
      await ctx.close();
    }

    // 폰 화면: 가장 많은 칸(9색+2)과 고비 레벨이 화면 안에 들어가는지
    for (const [n, w, h] of [[26, 360, 640], [30, 390, 780], [1, 430, 900]]) {
      ({ ctx, page, errors } = await openPage(browser, `${base}/web/index.html?mute=1&level=${n}`, { viewport: { width: w, height: h } }));
      const bad = await page.evaluate(() => [...document.querySelectorAll('.bin')].filter((b) => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth || r.bottom > innerHeight; }).length);
      const sideScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      check(!bad && !sideScroll && !errors.length, `레벨 ${n} @${w}×${h}: 칸이 화면 안, 가로 스크롤 없음`);
      if (SHOTS) await page.screenshot({ path: path.join(__dirname, `out/lv${n}_${w}.png`) });
      await ctx.close();
    }

    // 아티팩트판
    ({ ctx, page, errors } = await openPage(browser, `${base}/dist/artifact.html?mute=1`));
    check(!errors.length, `아티팩트판 오류 0 (${errors.join(' | ') || '없음'})`);
    await ctx.close();
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(fails.length ? `\n실패 ${fails.length}개 — 푸시하지 않는다` : '\n모두 통과');
  process.exit(fails.length ? 1 : 0);
})();
