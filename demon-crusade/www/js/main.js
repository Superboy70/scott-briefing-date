'use strict';
// ===== 화면 크기 / 입력 / 메인 루프 =====
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = clamp(w / h, 1.33, 2.4);
  VW = Math.round(VH * aspect);
  const scale = Math.min(w / VW, h / VH);
  SCALE = clamp(Math.ceil(scale * (window.devicePixelRatio || 1) / 1.5), 2, 4);
  canvas.width = VW * SCALE;
  canvas.height = VH * SCALE;
  canvas.style.width = `${Math.round(VW * scale)}px`;
  canvas.style.height = `${Math.round(VH * scale)}px`;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  // 노치/펀치홀 영역 피하기
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0;
  probe.remove();
  hudL = 8 + sl / scale; hudR = 8 + sr / scale;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

function requestFullscreen() {
  const el = document.documentElement;
  const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
  if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* 미지원 */ } }).catch(() => {});
}

// ---------- 터치 입력 ----------
const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
let firstTouch = true;
function onFirstGesture() {
  Audio8.init();
  if (firstTouch) {
    firstTouch = false;
    if (!isNative && matchMedia('(pointer: coarse)').matches) requestFullscreen();
  }
}
window.addEventListener('pointerdown', onFirstGesture);
window.addEventListener('keydown', onFirstGesture);

const dpad = document.getElementById('dpad');
const dpadPointers = new Map();
function dpadUpdate() {
  let l = false, r = false;
  const rect = dpad.getBoundingClientRect();
  const mid = rect.left + rect.width / 2;
  for (const x of dpadPointers.values()) { if (x < mid) l = true; else r = true; }
  input.left = l; input.right = r;
  dpad.children[0].classList.toggle('on', l);
  dpad.children[1].classList.toggle('on', r);
}
dpad.addEventListener('pointerdown', e => { e.preventDefault(); dpad.setPointerCapture(e.pointerId); dpadPointers.set(e.pointerId, e.clientX); dpadUpdate(); });
dpad.addEventListener('pointermove', e => { if (dpadPointers.has(e.pointerId)) { dpadPointers.set(e.pointerId, e.clientX); dpadUpdate(); } });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  dpad.addEventListener(ev, e => { dpadPointers.delete(e.pointerId); dpadUpdate(); });
}

document.querySelectorAll('#controls .btn').forEach(btn => {
  const key = btn.dataset.key;
  const down = e => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    btn.classList.add('on');
    if (key === 'menu') { pauseGame(); return; }
    if (key in input) input[key] = true;
    pressed[key] = true;
  };
  const up = () => { btn.classList.remove('on'); if (key in input) input[key] = false; };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
});
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- 키보드 ----------
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', KeyW: 'jump', ArrowUp: 'jump',
  KeyJ: 'attack', KeyZ: 'attack', KeyK: 's1', KeyX: 's1', KeyL: 's2', KeyC: 's2',
  KeyQ: 'hpPot', KeyE: 'mpPot',
};
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (G.state === 'play') pauseGame(); else if (G.state === 'pause' && G.view === 'main') resumeGame();
    return;
  }
  if (e.code === 'KeyI' && G.state === 'play') { pauseGame(); ACTIONS.view('inv'); return; }
  const k = KEYMAP[e.code];
  if (!k || G.state !== 'play') return;
  e.preventDefault();
  if (!e.repeat) pressed[k] = true;
  if (k in input) input[k] = true;
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k && k in input) input[k] = false; });

// ---------- 안드로이드 뒤로가기 / 백그라운드 ----------
function handleBack() {
  if (G.state === 'play') { pauseGame(); return; }
  if (G.state === 'pause') { if (G.view === 'main') resumeGame(); else ACTIONS.back(); return; }
  if ((G.state === 'town' || G.state === 'title') && G.view !== 'main') { ACTIONS.back(); return; }
  if (G.state === 'class') { goTitle(); return; }
  if (G.state === 'title' && isNative) {
    const App = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.exitApp) App.exitApp();
  }
}
try {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && App.addListener) App.addListener('backButton', handleBack);
} catch (e) { /* 웹 환경 */ }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (G.state === 'play') pauseGame();
    saveGame();
    Audio8.suspend();
  } else Audio8.resume();
});
window.addEventListener('pagehide', saveGame);

// ---------- 메인 루프 ----------
let last = performance.now();
let skillUiTick = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  gtime += dt;
  try {
    tick(dt);
  } catch (err) {
    console.error(err);
  }
  for (const k in pressed) pressed[k] = false;
  requestAnimationFrame(frame);
}

function tick(dt) {
  if (G.state === 'play' || G.state === 'dead' || G.state === 'clear' || G.state === 'victory') {
    if (G.state === 'play' || (P && P.dead)) {
      if (C) C.playTime += dt;
      updatePlayer(dt);
      updateEnemies(dt);
      updateShots(dt);
      updateMinions(dt);
    }
    updateParticles(dt);
    if (banner) banner.t -= dt;
    shake -= dt;
    // 카메라
    let minX = 0, maxX = L.width - VW;
    if (L.bossLock) { minX = L.arenaStart * TILE; maxX = Math.max(minX, L.width - VW); }
    const target = clamp(P.x - VW * 0.4, minX, maxX);
    camX += (target - camX) * Math.min(1, dt * 8);
    renderGame();
    skillUiTick -= dt;
    if (skillUiTick <= 0 && G.state === 'play') {
      skillUiTick = 0.1;
      const sk = CLASSES[C.cls].skills;
      for (let i = 0; i < 2; i++) {
        const lv = skillLevel(sk[i]);
        const el = document.getElementById(`btn-s${i + 1}`);
        el.classList.toggle('cool', P.skCd[i] > 0 || (lv > 0 && P.mp < SKILLS[sk[i]].mana(lv)));
      }
      document.getElementById('hp-cnt').textContent = C.hpPot;
      document.getElementById('mp-cnt').textContent = C.mpPot;
    }
  } else if (G.state === 'pause') {
    renderGame();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, VW, VH);
  } else if (G.state === 'town') {
    renderCamp();
  } else {
    renderTitleBG();
  }
}

// ---------- 시작 ----------
resize();
loadSettings();
goTitle();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:' && !isNative) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
