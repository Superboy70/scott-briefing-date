'use strict';
// ===== 렌더링 (모든 그래픽은 코드로 그린 픽셀아트) =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let VW = 480, SCALE = 2, hudL = 8, hudR = 8, gtime = 0;

const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// ---------- 배경 ----------
function drawSky(A, parallaxX) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, A.sky[0]); g.addColorStop(1, A.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // 달
  ctx.fillStyle = A.moon; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(VW * 0.78 - parallaxX * 0.02, 52, 22, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.25; ctx.fillStyle = A.sky[0];
  ctx.beginPath(); ctx.arc(VW * 0.78 - parallaxX * 0.02 + 8, 46, 18, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // 먼 실루엣
  ctx.fillStyle = A.far;
  const o1 = -(parallaxX * 0.15) % 160;
  for (let x = o1 - 160; x < VW + 160; x += 160) {
    ctx.beginPath(); ctx.moveTo(x, 190);
    ctx.lineTo(x + 30, 120); ctx.lineTo(x + 55, 150); ctx.lineTo(x + 90, 100); ctx.lineTo(x + 125, 160); ctx.lineTo(x + 160, 190);
    ctx.lineTo(x + 160, VH); ctx.lineTo(x, VH); ctx.fill();
  }
  // 중간 레이어
  ctx.fillStyle = A.mid;
  const o2 = -(parallaxX * 0.4) % 96;
  for (let x = o2 - 96; x < VW + 96; x += 96) {
    if (A.deco === 'castle' || A.deco === 'spike') {
      R(x + 10, 150, 22, 80, A.mid); R(x + 8, 144, 4, 6, A.mid); R(x + 18, 144, 4, 6, A.mid); R(x + 28, 144, 4, 6, A.mid);
      R(x + 50, 170, 40, 60, A.mid);
    } else if (A.deco === 'tree') {
      R(x + 20, 130, 6, 100, A.mid); R(x + 8, 150, 14, 3, A.mid); R(x + 24, 140, 16, 3, A.mid); R(x + 60, 160, 5, 70, A.mid); R(x + 52, 175, 20, 3, A.mid);
    } else {
      R(x + 10, 180, 50, 50, A.mid); R(x + 30, 160, 6, 22, A.mid); R(x + 25, 166, 16, 4, A.mid); R(x + 70, 190, 20, 40, A.mid);
    }
  }
  // 안개
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 3; i++) R(0, 170 + i * 18 + Math.sin(gtime * 0.5 + i) * 4, VW, 10, 'rgba(255,255,255,0.035)');
}

function drawTiles() {
  const A = L.A;
  const c0 = Math.max(0, Math.floor(camX / TILE)), c1 = Math.min(L.cols - 1, Math.ceil((camX + VW) / TILE));
  for (let c = c0; c <= c1; c++) {
    const x = c * TILE - camX;
    if (L.ground[c] < 0) {
      // 구덩이 바닥
      if (A.pit === 'lava') {
        R(x, 238, TILE, 40, '#b83008');
        R(x, 236 + Math.sin(gtime * 3 + c) * 2, TILE, 4, '#ff9020');
      } else if (A.pit === 'swamp') {
        R(x, 244, TILE, 30, '#1a3a24'); R(x, 243 + Math.sin(gtime * 2 + c) * 1.5, TILE, 2, '#3a6a40');
      }
    }
    for (let r = 0; r < ROWS; r++) {
      const tt = L.t[r * L.cols + c];
      if (!tt) continue;
      const y = r * TILE;
      if (tt === 1) {
        const top = tileAt(c, r - 1) !== 1;
        R(x, y, TILE, TILE, (c + r) % 2 ? A.ground : A.groundDark);
        R(x + 3, y + 5, 2, 2, A.groundDark); R(x + 10, y + 11, 3, 2, A.groundDark);
        if (top) { R(x, y, TILE, 4, A.groundTop); R(x + 2, y + 4, 3, 2, A.groundTop); R(x + 9, y + 4, 2, 1, A.groundTop); }
      } else if (tt === 2) {
        R(x, y, TILE, 5, '#6a4a2a'); R(x, y, TILE, 1, '#9a7a4a'); R(x + 7, y + 5, 2, 3, '#4a321a');
      }
    }
  }
}

function drawDecos() {
  const A = L.A;
  for (const d of L.decos) {
    const x = d.x - camX;
    if (x < -30 || x > VW + 30) continue;
    const y = d.y;
    if (A.deco === 'grave') {
      if (d.v < 0.35) { R(x, y - 12, 9, 12, '#5a5a66'); R(x + 1, y - 13, 7, 1, '#5a5a66'); R(x + 3, y - 9, 3, 1, '#333'); }
      else if (d.v < 0.6) { R(x + 3, y - 16, 3, 16, '#4a4a55'); R(x, y - 12, 9, 3, '#4a4a55'); }
      else if (d.v < 0.7) { R(x, y - 3, 12, 3, '#6a6050'); R(x + 2, y - 5, 2, 2, '#ddd'); }
    } else if (A.deco === 'tree') {
      if (d.v < 0.3) { R(x + 3, y - 30, 4, 30, '#2a1e14'); R(x - 4, y - 24, 8, 2, '#2a1e14'); R(x + 6, y - 20, 9, 2, '#2a1e14'); }
      else if (d.v < 0.6) { R(x, y - 5, 10, 5, '#2a4a2a'); R(x + 2, y - 8, 6, 3, '#3a5a30'); }
    } else if (A.deco === 'castle') {
      if (d.v < 0.25) { R(x, y - 34, 10, 34, '#4a3632'); R(x + 3, y - 30, 4, 4, '#ff9020'); R(x + 4, y - 33 + Math.sin(gtime * 8 + d.v * 9), 2, 3, '#ffd060'); }
      else if (d.v < 0.4) { R(x, y - 4, 8, 4, '#5a4038'); }
    } else {
      if (d.v < 0.35) { for (let i = 0; i < 3; i++) R(x + i * 4, y - 6 - (i % 2) * 4, 2, 6 + (i % 2) * 4, '#c8b8a0'); }
      else if (d.v < 0.5) { R(x, y - 3, 10, 3, '#6a2a3a'); R(x + 2, y - 6, 4, 3, '#ddd'); }
    }
  }
}

function drawObjects() {
  for (const o of L.objs) {
    const x = o.x - camX, y = o.y;
    if (x < -40 || x > VW + 40) continue;
    switch (o.kind) {
      case 'chest':
        if (o.used) { R(x, y + 6, 14, 6, '#5a3a1a'); R(x, y + 2, 14, 3, '#3a2410'); break; }
        R(x, y, 14, 12, '#8a5a24'); R(x, y, 14, 4, '#a8702e'); R(x, y + 4, 14, 1, '#3a2410'); R(x + 6, y + 4, 2, 3, '#ffd24a');
        R(x, y, 1, 12, '#d0a040'); R(x + 13, y, 1, 12, '#d0a040');
        break;
      case 'urn':
        if (o.used) { R(x, y + 9, 10, 3, '#6a4a30'); break; }
        R(x + 1, y + 2, 8, 10, '#8a5a3a'); R(x + 3, y, 4, 2, '#8a5a3a'); R(x + 1, y + 5, 8, 1, '#5a3a20');
        break;
      case 'shrine': {
        const col = { life: '#ff5050', armor: '#c8c8d8', exp: '#7fd0ff', combat: '#ffb040' }[o.sub];
        R(x + 2, y + 6, 12, 20, '#4a4a55'); R(x, y + 22, 16, 4, '#3a3a44'); R(x + 1, y + 4, 14, 3, '#5a5a66');
        if (!o.used) {
          ctx.globalAlpha = 0.6 + Math.sin(gtime * 4) * 0.3;
          R(x + 5, y + 10, 6, 8, col);
          ctx.globalAlpha = 0.25; R(x + 3, y - 4, 10, 12, col);
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'checkpoint':
        R(x + 5, y, 2, 30, '#9a8a70');
        R(x + 7, y + 1, 10, 7, o.used ? '#3a7fd0' : '#7a2020');
        break;
      case 'portal': {
        const cx = x + 11, cy = y + 17;
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = 0.25 + i * 0.12;
          ctx.fillStyle = i % 2 ? '#ff3030' : '#ff9060';
          ctx.beginPath(); ctx.ellipse(cx, cy, 11 - i * 2, 17 - i * 3, Math.sin(gtime * 2 + i) * 0.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

// ---------- 플레이어 ----------
function drawPlayer() {
  if (P.dead) return;
  if (P.inv > 0 && Math.floor(gtime * 20) % 2 && !P.cleared) return;
  const cl = CLASSES[C.cls].colors;
  ctx.save();
  ctx.translate(Math.round(P.x - camX + P.w / 2), Math.round(P.y));
  if (P.face < 0) ctx.scale(-1, 1);
  ctx.translate(-6, 0);
  const walk = P.onGround && Math.abs(P.vx) > 5 ? Math.sin(P.anim * 3) : 0;
  const l1 = walk > 0 ? 1 : 0, l2 = walk < 0 ? 1 : 0;
  if (P.buffs.shield > 0) { ctx.globalAlpha = 0.3 + Math.sin(gtime * 6) * 0.1; R(-4, -4, 20, 30, '#ffe07a'); ctx.globalAlpha = 1; }
  if (P.duck > 0) {
    R(1, 10, 11, 9, '#ffd84a'); R(7, 3, 6, 8, '#ffd84a'); R(12, 7, 4, 2, '#ff8a20'); R(10, 5, 1, 1, '#000');
    R(3, 19, 2, 3, '#ff8a20'); R(8, 19, 2, 3, '#ff8a20'); R(0, 12, 3, 3, '#e8c040');
  } else if (P.armor > 0) {
    R(-1, 7, 3, 10, cl.cape);
    R(3, 14 - l1, 3, 8 + l1, cl.armor); R(7, 14 - l2, 3, 8 + l2, cl.armor);
    R(3, 20, 3, 2, '#333'); R(7, 20, 3, 2, '#333');
    R(2, 6, 8, 9, cl.armor); R(2, 12, 8, 1, cl.trim); R(5, 7, 2, 4, cl.trim);
    if (C.cls === 'paladin') { R(2, 0, 8, 6, cl.armor); R(6, 2, 4, 1, '#111'); R(3, -3, 3, 3, cl.cape); }
    else if (C.cls === 'sorc') { R(2, 0, 8, 6, cl.armor); R(5, 2, 4, 3, '#f0c090'); R(8, 3, 1, 1, '#000'); R(3, -3, 5, 3, cl.armor); R(4, -5, 3, 2, cl.armor); }
    else { R(2, 0, 8, 6, cl.cape); R(5, 2, 4, 3, '#d8d0c0'); R(8, 3, 1, 1, '#c00'); }
  } else {
    // 갑옷이 부서지면… 하트 팬티 차림
    R(3, 14 - l1, 3, 8 + l1, '#f0c090'); R(7, 14 - l2, 3, 8 + l2, '#f0c090');
    R(3, 6, 7, 7, '#f0c090');
    R(3, 12, 7, 4, '#fff'); R(4, 13, 1, 1, '#e33'); R(7, 14, 1, 1, '#e33');
    R(3, 0, 7, 6, '#f0c090'); R(3, 0, 7, 2, '#5a3a1a'); R(8, 2, 1, 1, '#000');
  }
  if (P.duck <= 0) {
    if (P.atkAnim > 0) { R(8, 7, 7, 3, P.armor > 0 ? cl.armor : '#f0c090'); }
    else R(8, 7, 3, 6, P.armor > 0 ? cl.armor : '#f0c090');
  }
  ctx.restore();
}

function drawMinions() {
  for (const m of minions) {
    const x = Math.round(m.x - camX), y = Math.round(m.y);
    ctx.save();
    if (m.rise > 0) { ctx.beginPath(); ctx.rect(x - 4, 0, 24, y + m.h); ctx.clip(); ctx.translate(0, Math.min(1, m.rise / 0.5) * m.h); }
    drawSkeleton(x, y, m.face, m.anim, '#cfe8c0', '#6f8a60');
    ctx.restore();
  }
}

// ---------- 몬스터 ----------
function drawSkeleton(x, y, face, anim, bone = '#ddd8c0', dark = '#8a8570', bow = false) {
  ctx.save(); ctx.translate(x + 6, y); if (face < 0) ctx.scale(-1, 1); ctx.translate(-6, 0);
  const w = Math.sin(anim * 3) > 0 ? 1 : 0;
  R(3, 0, 7, 6, bone); R(6, 2, 2, 2, '#000'); R(4, 5, 5, 1, dark);
  R(5, 6, 3, 8, bone); R(3, 8, 7, 1, bone); R(3, 10, 7, 1, bone);
  R(4, 14, 2, 8 - w, bone); R(7, 14, 2, 7 + w, bone);
  if (bow) { R(10, 4, 1, 14, '#7a5a3a'); R(9, 4, 1, 1, '#7a5a3a'); R(9, 17, 1, 1, '#7a5a3a'); }
  else R(9, 8, 5, 2, bone);
  ctx.restore();
}

function drawEnemy(e) {
  const x = Math.round(e.x - camX), y = Math.round(e.y);
  if (x < -80 || x > VW + 80) return;
  ctx.save();
  if (e.dormant) { ctx.restore(); return; }
  if (e.rise > 0) { ctx.beginPath(); ctx.rect(x - 10, 0, e.w + 20, y + e.h); ctx.clip(); ctx.translate(0, Math.min(1, e.rise / 0.8) * e.h); }
  if (e.phased) ctx.globalAlpha = 0.25;
  if (e.tier === 1) { ctx.shadowColor = '#4a7aff'; ctx.shadowBlur = 6; }
  if (e.tier === 2) { ctx.shadowColor = '#ffcc40'; ctx.shadowBlur = 8; }
  const flip = e.face < 0;
  const f = Math.floor(e.t * 8) % 2;
  switch (e.type) {
    case 'zombie': {
      ctx.translate(x + 6, y); if (flip) ctx.scale(-1, 1); ctx.translate(-6, 0);
      R(3, 0, 7, 6, '#7a9a5a'); R(7, 2, 2, 1, '#e22'); R(3, 0, 7, 1, '#3a4a2a');
      R(2, 6, 8, 8, '#5a4a6a'); R(3, 9, 3, 2, '#7a9a5a');
      R(8, 7, 6, 2, '#7a9a5a');
      R(3, 14, 3, 8 - f, '#4a3a3a'); R(7, 14, 3, 7 + f, '#4a3a3a');
      break;
    }
    case 'skeleton': drawSkeleton(x, y, e.face, e.t); break;
    case 'archer': drawSkeleton(x, y, e.face, 0, '#d8d0b0', '#8a8570', true); break;
    case 'crow': case 'bat': {
      const body = e.type === 'crow' ? '#1a1a22' : '#4a2a5a';
      ctx.translate(x + 6, y); if (flip) ctx.scale(-1, 1); ctx.translate(-6, 0);
      R(3, 3, 7, 4, body); R(9, 3, 3, 2, body); R(11, 4, 2, 1, e.type === 'crow' ? '#d0a040' : '#f44');
      if (f) { R(0, 0, 5, 3, body); R(6, 0, 4, 3, body); } else { R(0, 6, 5, 3, body); R(6, 6, 4, 3, body); }
      break;
    }
    case 'ghost':
      ctx.globalAlpha *= 0.8;
      R(x + 2, y, 10, 12, '#d8e8f0'); R(x, y + 6, 14, 8, '#d8e8f0');
      for (let i = 0; i < 4; i++) R(x + i * 4, y + 14 + ((i + f) % 2) * 2, 3, 3, '#d8e8f0');
      R(x + 4, y + 4, 2, 3, '#113'); R(x + 9, y + 4, 2, 3, '#113');
      break;
    case 'plant':
      R(x + 6, y + 8, 3, 12, '#2a6a2a'); R(x + 1, y + 14, 5, 3, '#3a8a3a'); R(x + 9, y + 12, 5, 3, '#3a8a3a');
      R(x + 1, y, 12, 9, '#b02a3a'); R(x + 3, y + 3 + (e.cd < 0.4 ? 0 : 2), 8, 2, '#300');
      R(x + 2, y + 1, 2, 2, '#fff'); R(x + 9, y + 1, 2, 2, '#fff');
      break;
    case 'spider': case 'spiderling': {
      const s = e.type === 'spider' ? 1 : 0.7;
      ctx.translate(x, y); ctx.scale(s, s);
      R(3, 2, 9, 7, '#2a1a2a'); R(10, 3, 4, 4, '#3a2a3a'); R(12, 4, 1, 1, '#f33');
      for (let i = 0; i < 4; i++) { R(2 + i * 3, 8, 1, 3 + ((i + f) % 2), '#1a0a1a'); R(1 + i * 3, 9, 1, 1, '#1a0a1a'); }
      break;
    }
    case 'imp':
      ctx.translate(x + 6, y); if (flip) ctx.scale(-1, 1); ctx.translate(-6, 0);
      R(2, 2, 8, 7, '#c83a1a'); R(2, 0, 2, 2, '#fda'); R(8, 0, 2, 2, '#fda'); R(7, 4, 2, 1, '#ff0');
      R(3, 9, 6, 5, '#a82a10'); R(3, 14, 2, 2, '#a82a10'); R(7, 14, 2, 2, '#a82a10');
      R(0, 10, 3, 1, '#a82a10');
      break;
    case 'demon': {
      ctx.translate(x + 9, y); if (flip) ctx.scale(-1, 1); ctx.translate(-9, 0);
      const wing = e.state === 'dive' ? 0 : f;
      R(-4, 2 + wing * 3, 8, 8 - wing * 3, '#3a0a10'); R(12, 2 + wing * 3, 9, 8 - wing * 3, '#3a0a10');
      R(4, 3, 10, 12, '#d02a2a'); R(5, 0, 8, 5, '#d02a2a'); R(4, -2, 2, 3, '#ffe'); R(12, -2, 2, 3, '#ffe');
      R(10, 2, 2, 1, '#ff0'); R(5, 15, 3, 5, '#a01a1a'); R(10, 15, 3, 5, '#a01a1a');
      R(13, 8, 5, 2, '#d02a2a');
      break;
    }
    case 'knight':
      ctx.translate(x + 8, y); if (flip) ctx.scale(-1, 1); ctx.translate(-8, 0);
      R(3, 0, 10, 8, '#2a2a34'); R(9, 3, 3, 1, '#f22'); R(2, -3, 2, 4, '#2a2a34'); R(12, -3, 2, 4, '#2a2a34');
      R(2, 8, 12, 10, '#3a3a48'); R(4, 18, 3, 8 - f, '#2a2a34'); R(9, 18, 3, 7 + f, '#2a2a34');
      R(13, 6, 4, 14, '#6a1a1a'); R(14, 8, 2, 10, '#aa8a3a');
      break;
    case 'graveLord': {
      ctx.translate(x + 20, y); if (flip) ctx.scale(-1, 1); ctx.translate(-20, 0);
      R(8, 0, 24, 18, '#e0d8c0'); R(10, -6, 4, 6, '#d0a040'); R(18, -8, 4, 8, '#d0a040'); R(26, -6, 4, 6, '#d0a040'); R(10, -2, 20, 3, '#d0a040');
      R(12, 6, 6, 5, '#000'); R(24, 6, 6, 5, '#000'); R(14, 7, 2, 2, '#f40'); R(26, 7, 2, 2, '#f40');
      R(12, 14, 16, 3, '#555');
      R(10, 18, 20, 20, '#4a2a5a'); R(14, 20, 12, 14, '#e0d8c0'); for (let i = 0; i < 4; i++) R(14, 22 + i * 3, 12, 1, '#4a2a5a');
      R(30, 20, 10, 5, '#e0d8c0'); R(0, 20, 10, 5, '#e0d8c0');
      R(12, 38, 6, 16, '#e0d8c0'); R(22, 38, 6, 16, '#e0d8c0');
      break;
    }
    case 'spiderQueen': {
      ctx.translate(x + 27, y); if (flip) ctx.scale(-1, 1); ctx.translate(-27, 0);
      R(4, 4, 28, 18, '#2a1030'); R(8, 8, 8, 6, '#a02040');
      R(30, 6, 16, 12, '#3a1a40'); R(42, 8, 2, 2, '#f33'); R(38, 8, 2, 2, '#f33'); R(40, 12, 2, 2, '#f33');
      R(44, 16, 6, 2, '#ddd');
      for (let i = 0; i < 4; i++) { const k = (i + f) % 2; R(10 + i * 9, 20, 2, 8 + k * 2, '#1a0a20'); R(6 + i * 9, 26 + k * 2, 5, 2, '#1a0a20'); }
      break;
    }
    case 'flameTyrant': {
      ctx.translate(x + 22, y); if (flip) ctx.scale(-1, 1); ctx.translate(-22, 0);
      R(-10, 6 + f * 4, 16, 16 - f * 4, '#5a0a0a'); R(38, 6 + f * 4, 16, 16 - f * 4, '#5a0a0a');
      R(8, 6, 28, 30, '#e04a10'); R(12, 0, 20, 12, '#e04a10'); R(10, -6, 4, 8, '#ffd070'); R(30, -6, 4, 8, '#ffd070');
      R(26, 4, 4, 3, '#ff0'); R(16, 4, 4, 3, '#ff0'); R(16, 12, 16, 3, '#400');
      R(12, 36, 6, 8, '#b03008'); R(26, 36, 6, 8, '#b03008');
      ctx.globalAlpha *= 0.5; R(10, -12 + Math.sin(gtime * 10) * 2, 24, 8, '#ffb040');
      break;
    }
    case 'terrorLord': {
      ctx.translate(x + 25, y); if (flip) ctx.scale(-1, 1); ctx.translate(-25, 0);
      const rage = e.hp < e.maxHp * 0.5;
      const body = rage ? '#b01020' : '#7a1020';
      R(12, 0, 26, 18, body); R(8, -10, 5, 14, '#d8c8a0'); R(37, -10, 5, 14, '#d8c8a0'); R(6, -12, 4, 4, '#d8c8a0'); R(40, -12, 4, 4, '#d8c8a0');
      R(28, 6, 5, 3, '#ff0'); R(18, 6, 5, 3, '#ff0'); R(18, 13, 16, 3, '#200');
      R(6, 18, 38, 26, body); for (let i = 0; i < 5; i++) R(8 + i * 7, 16, 3, 6, '#d8c8a0');
      R(0, 20, 8, 20, body); R(42, 20, 8, 20, body); R(44, 38, 6, 4, '#d8c8a0');
      R(10, 44, 10, 20, body); R(30, 44, 10, 20, body);
      break;
    }
  }
  ctx.restore();
  // 이름/체력
  if (e.def.boss) return;
  if (e.tier > 0 || e.hp < e.maxHp) {
    const bw = Math.max(16, e.w);
    const bx = x + e.w / 2 - bw / 2;
    R(bx, y - 5, bw, 2, '#300'); R(bx, y - 5, bw * Math.max(0, e.hp / e.maxHp), 2, e.tier === 2 ? '#ffcc40' : e.tier === 1 ? '#6a8aff' : '#d33');
  }
  if (e.tier === 2) {
    ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(e.eliteName, x + e.w / 2 + 0.5, y - 8.5);
    ctx.fillStyle = '#ffcc40'; ctx.fillText(e.eliteName, x + e.w / 2, y - 9);
    ctx.fillStyle = '#7b93ff'; ctx.font = '6px sans-serif'; ctx.fillText(ELITE_AFFIX[e.affix].name, x + e.w / 2, y - 16);
  }
}

// ---------- 투사체 ----------
function drawShots() {
  for (const s of shots) {
    const x = s.x - camX, y = s.y;
    switch (s.kind) {
      case 'weapon':
        switch (s.wt) {
          case 'lance': R(x, y, 14, 2, '#d8d8e8'); R(s.face > 0 ? x + 11 : x, y - 1, 3, 4, '#ffffff'); R(s.face > 0 ? x : x + 12, y, 2, 2, '#8a5a2a'); break;
          case 'dagger': R(x, y, 8, 2, '#e8e8f0'); R(s.face > 0 ? x : x + 6, y - 1, 2, 4, '#aa8a3a'); break;
          case 'axe': {
            ctx.save(); ctx.translate(x + 5, y + 5); ctx.rotate(s.rot * s.face);
            R(-1, -5, 2, 10, '#8a5a2a'); R(1, -5, 4, 5, '#c8c8d8'); ctx.restore(); break;
          }
          case 'torch': R(x + 3, y + 2, 2, 6, '#7a4a2a'); R(x + 1, y - 1 + Math.sin(gtime * 30), 6, 4, '#ff9020'); R(x + 2, y - 2, 4, 2, '#ffe060'); break;
          case 'orb':
            ctx.fillStyle = '#b080ff'; ctx.beginPath(); ctx.arc(x + 4, y + 4, 4, 0, Math.PI * 2); ctx.fill();
            R(x + 2, y + 2, 2, 2, '#fff'); break;
        }
        break;
      case 'frozenOrb':
        ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(x + 5, y + 5, 5 + Math.sin(gtime * 20), 0, Math.PI * 2); ctx.fill();
        R(x + 3, y + 3, 3, 3, '#fff'); break;
      case 'shard': R(x, y, 4, 4, '#bfe8ff'); break;
      case 'boneSpear': R(x, y, 18, 4, '#e8e8d0'); R(s.face > 0 ? x + 14 : x, y - 1, 4, 6, '#fff'); break;
    }
  }
  for (const s of eshots) {
    const x = s.x - camX, y = s.y;
    switch (s.kind) {
      case 'arrow': R(x, y + 1, 10, 1, '#b8a070'); R(s.vx > 0 ? x + 8 : x, y, 2, 3, '#ccc'); break;
      case 'seed': R(x, y, 6, 6, '#6a3a8a'); R(x + 1, y + 1, 2, 2, '#b080d0'); break;
      case 'fire':
        R(x, y, s.w, s.h, '#ff6020'); R(x + 2, y + 2, s.w - 4, s.h - 4, '#ffe060'); break;
      case 'bone': R(x, y + 3, 8, 2, '#e0d8c0'); R(x, y + 2, 2, 4, '#e0d8c0'); R(x + 6, y + 2, 2, 4, '#e0d8c0'); break;
      case 'wave': R(x, y + 4 + Math.sin(gtime * 30) * 2, 12, 8, '#9a8a70'); R(x + 2, y, 8, 4, '#c8b890'); break;
      case 'web': ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.strokeRect(x + 1, y + 1, 8, 8); R(x + 4, y, 1, 10, '#eee'); R(x, y + 4, 10, 1, '#eee'); break;
      case 'beam':
        if (s.warn > 0) { ctx.globalAlpha = 0.3 + Math.sin(gtime * 30) * 0.2; R(x, y + 3, s.w, 2, '#ff4040'); ctx.globalAlpha = 1; }
        else { R(x, y, s.w, s.h, '#a0c0ff'); R(x, y + 3, s.w, 2, '#fff'); }
        break;
    }
  }
  for (const f of fx) {
    const a = f.t / f.max;
    switch (f.kind) {
      case 'flame':
        for (let i = 0; i < 4; i++) R(f.x - camX + i * 5, f.y + 4 - Math.abs(Math.sin(gtime * 12 + i)) * 6 * a, 4, 6 + 4 * a, i % 2 ? '#ff9020' : '#ff4010');
        break;
      case 'arc':
        ctx.strokeStyle = f.col; ctx.lineWidth = 3; ctx.globalAlpha = a;
        ctx.save(); ctx.translate(f.x - camX, f.y); ctx.scale(f.face, 1); ctx.beginPath(); ctx.arc(-10, 0, 20, -1.1, 1.1); ctx.stroke(); ctx.restore();
        ctx.globalAlpha = 1;
        break;
      case 'slash':
        ctx.save(); ctx.translate(f.x - camX, f.y); ctx.scale(f.face, 1);
        ctx.strokeStyle = f.col; ctx.lineWidth = 2.5; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(-6, 0, 14, -1.3 + (1 - a) * 0.8, 0.6 + (1 - a) * 0.8); ctx.stroke();
        ctx.restore(); ctx.globalAlpha = 1;
        break;
      case 'bolt': {
        ctx.strokeStyle = '#ffff90'; ctx.lineWidth = 2; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.moveTo(f.x1 - camX, f.y1);
        for (let i = 1; i < 5; i++) ctx.lineTo(f.x1 + (f.x2 - f.x1) * i / 5 - camX + rand(-4, 4), f.y1 + (f.y2 - f.y1) * i / 5 + rand(-6, 6));
        ctx.lineTo(f.x2 - camX, f.y2); ctx.stroke(); ctx.globalAlpha = 1;
        break;
      }
      case 'wizard': {
        const x = f.x - camX, y = f.y - 10;
        ctx.globalAlpha = Math.min(1, a * 2);
        R(x - 5, y, 10, 14, '#4a2a8a'); R(x - 3, y - 6, 6, 6, '#4a2a8a'); R(x - 1, y - 10, 2, 4, '#4a2a8a');
        R(x - 2, y + 2, 4, 3, '#f0c090'); R(x - 2, y + 5, 4, 5, '#ddd');
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

function drawPickups() {
  ctx.textAlign = 'center';
  for (const pk of pickups) {
    const x = pk.x - camX, y = pk.y;
    if (x < -40 || x > VW + 40) continue;
    switch (pk.kind) {
      case 'gold': R(x + 2, y + 5, 6, 5, '#d0a020'); R(x + 3, y + 3, 5, 3, '#ffd24a'); break;
      case 'hp': R(x + 3, y + 1, 4, 2, '#aaa'); R(x + 2, y + 3, 6, 7, '#d02020'); R(x + 3, y + 4, 2, 2, '#ff8080'); break;
      case 'mp': R(x + 3, y + 1, 4, 2, '#aaa'); R(x + 2, y + 3, 6, 7, '#2040d0'); R(x + 3, y + 4, 2, 2, '#80a0ff'); break;
      case 'armor': R(x + 1, y + 1, 8, 9, '#c8c8d8'); R(x + 3, y + 3, 4, 2, '#fff'); R(x, y, 10, 2, '#d9a93e'); break;
      case 'item': {
        const it = pk.item, col = RARITY[it.rarity].color;
        if (it.rarity === 'unique' || it.rarity === 'rare') {
          ctx.globalAlpha = 0.25 + Math.sin(gtime * 4) * 0.1;
          R(x + 3, y - 60, 4, 70, col);
          ctx.globalAlpha = 1;
        }
        R(x + 1, y + 2, 8, 8, col); R(x + 3, y + 4, 4, 4, '#000'); R(x + 4, y + 5, 2, 2, col);
        ctx.font = '7px sans-serif';
        const w = ctx.measureText(it.name).width + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x + 5 - w / 2, y - 12, w, 9);
        ctx.fillStyle = col; ctx.fillText(it.name, x + 5, y - 5);
        break;
      }
    }
  }
}

function drawParticles() {
  for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 3); R(p.x - camX, p.y, p.sz, p.sz, p.col); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 8px sans-serif';
  for (const t of texts) {
    ctx.globalAlpha = Math.min(1, t.t * 2);
    ctx.fillStyle = '#000'; ctx.fillText(t.txt, t.x - camX + 1, t.y + 1);
    ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x - camX, t.y);
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD ----------
function orb(cx, cy, r, frac, col, dark) {
  ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  R(cx - r, cy - r, r * 2, r * 2, dark);
  const h = r * 2 * clamp(frac, 0, 1);
  R(cx - r, cy + r - h, r * 2, h, col);
  R(cx - r, cy + r - h, r * 2, 2, 'rgba(255,255,255,0.35)');
  ctx.restore();
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.stroke();
}

function drawHUD() {
  const lx = hudL + 20, rx = VW - hudR - 20;
  orb(lx, 24, 17, P.hp / S.maxHP, '#c02020', '#300808');
  orb(rx, 24, 17, P.mp / S.maxMP, '#2040c0', '#080a30');
  ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.max(0, Math.ceil(P.hp))}/${S.maxHP}`, lx, 27);
  ctx.fillText(`${Math.floor(P.mp)}/${S.maxMP}`, rx, 27);
  // 갑옷
  const aw = 44;
  R(lx - 22, 45, aw, 5, '#222'); R(lx - 22, 45, aw * (S.armorMax ? P.armor / S.armorMax : 0), 5, P.armor > 0 ? '#c8c8d8' : '#555');
  ctx.font = '6px sans-serif'; ctx.fillStyle = '#ddd'; ctx.fillText(P.armor > 0 ? `갑옷 ${Math.ceil(P.armor)}` : '갑옷 없음!', lx, 57);
  // 경험치 / 진행
  const bx = hudL + 44, bw = VW - hudL - hudR - 88;
  R(bx, 4, bw, 3, '#222'); R(bx, 4, bw * C.exp / expToNext(C.level), 3, '#c8a040');
  R(bx, 9, bw, 1, '#333'); R(bx + bw * clamp(P.x / L.width, 0, 1) - 1, 8, 3, 3, '#ff5040');
  ctx.textAlign = 'left'; ctx.font = 'bold 8px sans-serif';
  ctx.fillStyle = '#e6dcc8'; ctx.fillText(`Lv ${C.level}`, bx, 20);
  ctx.fillStyle = '#ffd24a'; ctx.fillText(`${C.gold} G`, bx + 32, 20);
  let ix = bx;
  ctx.font = '7px sans-serif';
  const buffs = [];
  if (P.buffs.shield > 0) buffs.push(['신성 방패', '#ffe07a']);
  if (P.buffs.exp > 0) buffs.push(['경험 +50%', '#7fd0ff']);
  if (P.buffs.combat > 0) buffs.push(['전투 +50%', '#ffb040']);
  if (P.duck > 0) buffs.push([`오리 저주 ${Math.ceil(P.duck)}`, '#b48cff']);
  if (P.webbed > 0) buffs.push(['거미줄', '#ddd']);
  for (const [t, c] of buffs) { ctx.fillStyle = c; ctx.fillText(t, ix, 30); ix += ctx.measureText(t).width + 8; }
  // 보스 체력
  if (bossRef && !bossRef.dead) {
    const w = Math.min(240, VW * 0.5), x = VW / 2 - w / 2;
    R(x - 1, 39, w + 2, 7, '#000'); R(x, 40, w * bossRef.hp / bossRef.maxHp, 5, '#b01818');
    ctx.textAlign = 'center'; ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = '#ffcc40';
    ctx.fillText(bossRef.def.name, VW / 2, 36);
  }
  // 배너
  if (banner && banner.t > 0) {
    ctx.globalAlpha = Math.min(1, banner.t * 1.5);
    ctx.textAlign = 'center';
    if (banner.small) {
      ctx.font = 'bold 13px serif'; ctx.fillStyle = '#000'; ctx.fillText(banner.title, VW / 2 + 1, 91);
      ctx.fillStyle = banner.col || '#fff'; ctx.fillText(banner.title, VW / 2, 90);
    } else {
      ctx.font = 'bold 20px serif'; ctx.fillStyle = '#000'; ctx.fillText(banner.title, VW / 2 + 1, 101);
      ctx.fillStyle = banner.boss ? '#ff5040' : '#e0b060'; ctx.fillText(banner.title, VW / 2, 100);
      ctx.font = '9px serif'; ctx.fillStyle = '#ccc'; ctx.fillText(banner.sub, VW / 2, 116);
    }
    ctx.globalAlpha = 1;
  }
}

function renderGame() {
  const sx = shake > 0 ? rand(-2, 2) : 0, sy = shake > 0 ? rand(-2, 2) : 0;
  ctx.save(); ctx.translate(sx, sy);
  drawSky(L.A, camX);
  drawDecos();
  drawTiles();
  drawObjects();
  drawPickups();
  for (const e of enemies) drawEnemy(e);
  drawMinions();
  drawPlayer();
  drawShots();
  drawParticles();
  ctx.restore();
  drawHUD();
}

// ---------- 마을 / 타이틀 배경 ----------
function renderCamp() {
  const A = { sky: ['#0a0a1a', '#2a1a2a'], moon: '#f0e8d0', far: '#141024', mid: '#1c1628', deco: 'grave' };
  drawSky(A, gtime * 6);
  R(0, 208, VW, 62, '#2a2218'); R(0, 206, VW, 4, '#3a4a24');
  // 천막
  const tent = (x, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, 208); ctx.lineTo(x + 30, 160); ctx.lineTo(x + 60, 208); ctx.fill(); R(x + 26, 190, 8, 18, '#100a06'); };
  tent(VW * 0.08, '#6a4a2a'); tent(VW * 0.72, '#5a3a3a'); tent(VW * 0.86, '#4a4a3a');
  // 모닥불
  const fx0 = VW * 0.45;
  R(fx0 - 10, 204, 20, 4, '#4a2a14');
  for (let i = 0; i < 6; i++) {
    const h = 10 + Math.abs(Math.sin(gtime * 9 + i * 1.7)) * 12;
    R(fx0 - 8 + i * 3, 204 - h, 3, h, i % 2 ? '#ff9020' : '#ffd040');
  }
  ctx.globalAlpha = 0.12 + Math.sin(gtime * 7) * 0.03;
  ctx.fillStyle = '#ff8020'; ctx.beginPath(); ctx.arc(fx0, 196, 70, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // NPC
  const npc = (x, robe, head) => { R(x, 186, 10, 20, robe); R(x + 2, 178, 6, 8, head); R(x + 1, 176, 8, 3, robe); };
  npc(VW * 0.3, '#3a5a8a', '#f0c090');
  npc(VW * 0.58, '#6a3a1a', '#d8a070');
  npc(VW * 0.64, '#5a2a6a', '#e0b890');
  for (let i = 0; i < 6; i++) { R(i * 90 + 20, 196, 3, 12, '#4a3a2a'); R(i * 90 + 20, 198, 70, 2, '#4a3a2a'); }
}

function renderTitleBG() {
  drawSky(ACTS[0], gtime * 20);
  R(0, 220, VW, 50, '#3a2c20'); R(0, 218, VW, 4, '#4a5a2a');
  const off = -(gtime * 20) % 64;
  for (let x = off; x < VW + 64; x += 64) {
    R(x + 10, 206, 9, 12, '#5a5a66'); R(x + 11, 205, 7, 1, '#5a5a66');
    R(x + 40, 202, 3, 16, '#4a4a55'); R(x + 37, 206, 9, 3, '#4a4a55');
  }
}
