'use strict';
// ===== 지형 생성 / 충돌 =====
// 타일: 0 빈칸, 1 벽/땅, 2 한방향 발판
let L = null; // 현재 레벨

function genLevel(stageIdx, diff) {
  const { act, st } = stageInfo(stageIdx);
  const A = ACTS[act];
  const boss = st === 2;
  const cols = boss ? 96 : 190 + act * 12 + st * 18;
  const t = new Uint8Array(cols * ROWS);
  const ground = new Array(cols).fill(-1);
  const set = (c, r, v) => { if (c >= 0 && c < cols && r >= 0 && r < ROWS) t[r * cols + c] = v; };
  const fill = (c, h) => { ground[c] = h; for (let r = h; r < ROWS; r++) set(c, r, 1); };
  const objs = [], spawns = [], decos = [];
  const mlvl = monsterLevel(stageIdx, diff);

  let h = 13, c = 0;
  for (; c < 14; c++) fill(c, h);
  const arenaStart = boss ? 52 : -1;
  const endSafe = boss ? arenaStart - 4 : cols - 18;
  const enemyGap = () => irand(5, 10) - Math.min(3, act);

  let nextEnemy = 18;
  let lastPit = -99;
  while (c < endSafe) {
    const roll = Math.random();
    if (roll < 0.17 && c - lastPit > 10) {
      // 구덩이 (마계촌식 낙사 구간)
      const w = irand(2, 3);
      for (let i = 0; i < w && c < endSafe; i++, c++) ground[c] = -1;
      lastPit = c;
      const run = irand(4, 7);
      for (let i = 0; i < run && c < endSafe; i++, c++) fill(c, h);
    } else if (roll < 0.35) {
      // 계단
      h = clamp(h + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 2 : 1), 10, 14);
      const run = irand(5, 9);
      for (let i = 0; i < run && c < endSafe; i++, c++) fill(c, h);
    } else if (roll < 0.52) {
      // 공중 발판
      const run = irand(9, 13);
      const start = c;
      for (let i = 0; i < run && c < endSafe; i++, c++) fill(c, h);
      const pw = irand(3, 6), px = start + irand(1, Math.max(1, run - pw - 1)), pr = h - 3;
      for (let i = 0; i < pw; i++) set(px + i, pr, 2);
      if (h - 6 >= 4 && Math.random() < 0.45) {
        const p2 = px + irand(-1, 2);
        for (let i = 0; i < 3; i++) set(p2 + i, h - 6, 2);
        if (Math.random() < 0.5) objs.push({ kind: 'chest', x: (p2 + 1) * TILE, y: (h - 6) * TILE - 12, w: 14, h: 12 });
      }
    } else {
      // 평지 + 장애물(묘비/기둥)
      const run = irand(6, 12);
      for (let i = 0; i < run && c < endSafe; i++, c++) {
        fill(c, h);
        if (i > 1 && i < run - 2 && Math.random() < 0.06) set(c, h - 1, 1);
      }
    }
  }
  // 끝부분 평지
  if (boss) {
    for (; c < arenaStart; c++) fill(c, 13);
    for (; c < cols; c++) fill(c, 13);
    // 아레나 벽 + 발판
    for (let r = 0; r < 13; r++) set(cols - 1, r, 1);
    const mid = arenaStart + Math.floor((cols - arenaStart) / 2);
    for (let i = -9; i <= -5; i++) set(mid + i, 9, 2);
    for (let i = 5; i <= 9; i++) set(mid + i, 9, 2);
    for (let i = -2; i <= 2; i++) set(mid + i, 6, 2);
  } else {
    h = 13;
    for (; c < cols; c++) fill(c, h);
    for (let r = 0; r < h; r++) set(cols - 1, r, 1);
  }

  // 적 배치
  for (let cc = nextEnemy; cc < endSafe; cc += enemyGap()) {
    if (ground[cc] < 0) continue;
    const type = wpick(A.enemies);
    const def = ENEMIES[type];
    const x = cc * TILE + 2;
    let y = ground[cc] * TILE - def.h;
    if (def.fly) y = irand(50, 120);
    spawns.push({ type, x, y });
    if (Math.random() < 0.18 && !def.fly) spawns.push({ type, x: x + 20, y });
  }
  // 1막 두 번째 지역부터 붉은 악마 등장 (마계촌 레드 아리마 오마주)
  if (!boss && (st === 1 || act >= 1)) {
    const cc = Math.floor(cols * 0.72);
    spawns.push({ type: 'demon', x: cc * TILE, y: 70, elite: act === 0 });
  }

  // 오브젝트: 상자, 항아리, 성소, 체크포인트, 포털
  for (let cc = 24; cc < endSafe; cc += irand(14, 26)) {
    if (ground[cc] < 0 || t[(ground[cc] - 1) * cols + cc]) continue;
    const gy = ground[cc] * TILE;
    const r = Math.random();
    if (r < 0.28) objs.push({ kind: 'chest', x: cc * TILE + 1, y: gy - 12, w: 14, h: 12 });
    else if (r < 0.75) objs.push({ kind: 'urn', x: cc * TILE + 3, y: gy - 12, w: 10, h: 12 });
  }
  const shrineTypes = ['life', 'armor', 'exp', 'combat'];
  for (let n = 0; n < (boss ? 1 : 2); n++) {
    let cc = Math.floor(endSafe * (n + 1) / 3) + irand(-4, 4);
    while (cc < endSafe && ground[cc] < 0) cc++;
    if (ground[cc] >= 0) objs.push({ kind: 'shrine', sub: pick(shrineTypes), x: cc * TILE, y: ground[cc] * TILE - 26, w: 16, h: 26 });
  }
  let cpX = -1;
  if (!boss) {
    let cc = Math.floor(cols / 2);
    while (ground[cc] < 0) cc++;
    cpX = cc * TILE;
    objs.push({ kind: 'checkpoint', x: cpX, y: ground[cc] * TILE - 30, w: 12, h: 30 });
    objs.push({ kind: 'portal', x: (cols - 5) * TILE, y: 13 * TILE - 34, w: 22, h: 34 });
  }

  // 배경 장식
  for (let cc = 2; cc < cols - 2; cc += irand(2, 6)) {
    if (ground[cc] < 0) continue;
    decos.push({ x: cc * TILE + irand(0, 8), y: ground[cc] * TILE, v: Math.random() });
  }

  L = {
    stageIdx, diff, act, st, A, boss, cols, t, ground, objs, spawns, decos, mlvl,
    width: cols * TILE, arenaStart, cpX, bossTriggered: false, bossLock: false,
    name: A.stages[st],
  };
  return L;
}

function tileAt(c, r) {
  if (c < 0 || c >= L.cols) return 1;
  if (r < 0 || r >= ROWS) return 0;
  return L.t[r * L.cols + c];
}
function solidAtPx(x, y) { return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 1; }

// 물리 이동 + 타일 충돌
function moveBody(b, dt, opts = {}) {
  if (!opts.noGrav) {
    b.vy += GRAV * (b.gscale ?? 1) * dt;
    if (b.vy > 520) b.vy = 520;
  }
  b.hitWall = false;
  // X
  let nx = b.x + b.vx * dt;
  const r0 = Math.floor((b.y + 1) / TILE), r1 = Math.floor((b.y + b.h - 1) / TILE);
  if (b.vx > 0) {
    const cc = Math.floor((nx + b.w) / TILE);
    for (let r = r0; r <= r1; r++) if (tileAt(cc, r) === 1) { nx = cc * TILE - b.w - 0.01; b.vx = 0; b.hitWall = true; break; }
  } else if (b.vx < 0) {
    const cc = Math.floor(nx / TILE);
    for (let r = r0; r <= r1; r++) if (tileAt(cc, r) === 1) { nx = (cc + 1) * TILE + 0.01; b.vx = 0; b.hitWall = true; break; }
  }
  b.x = nx;
  // Y
  let ny = b.y + b.vy * dt;
  b.onGround = false;
  const c0 = Math.floor((b.x + 1) / TILE), c1 = Math.floor((b.x + b.w - 1) / TILE);
  if (b.vy >= 0) {
    const rr = Math.floor((ny + b.h) / TILE);
    for (let c = c0; c <= c1; c++) {
      const tt = tileAt(c, rr);
      if (tt === 1 || (tt === 2 && b.y + b.h <= rr * TILE + 1 && !b.dropThrough)) {
        ny = rr * TILE - b.h; b.vy = 0; b.onGround = true; break;
      }
    }
  } else {
    const rr = Math.floor(ny / TILE);
    for (let c = c0; c <= c1; c++) if (tileAt(c, rr) === 1) { ny = (rr + 1) * TILE + 0.01; b.vy = 0; break; }
  }
  b.y = ny;
}

// 지면 확인 (가장자리 판정용)
function groundBelow(x, y) {
  const c = Math.floor(x / TILE);
  for (let r = Math.floor(y / TILE); r < ROWS; r++) { const tt = tileAt(c, r); if (tt) return r * TILE; }
  return null;
}
